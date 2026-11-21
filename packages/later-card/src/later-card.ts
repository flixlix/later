import { loadHaForm } from "@later/shared/ui-editor/load-ha-form";
import { registerCustomCard } from "@later/shared/utils/register-custom-card";
import { mdiClose, mdiPlus, mdiTimerSandComplete, mdiTimerOutline } from "@mdi/js";
import {
  type HomeAssistant,
  type LovelaceCard,
  type LovelaceCardEditor,
} from "custom-card-helpers";
import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { assert, StructError } from "superstruct";
import { version } from "../package.json";
import { LaterCreateForm } from "./create-form";
import { actionSummary } from "./request";
import { type Clock, clockLabel, relativeLabel } from "./time";
import {
  type AddRequest,
  type LaterCardConfig,
  laterCardConfigStruct,
  type Schedule,
} from "./types";
import { LaterCardEditor } from "./ui-editor/ui-editor";
import {
  addSchedule,
  cancelSchedule,
  subscribeSchedules,
  websocketError,
  type WebsocketError,
} from "./websocket";

registerCustomCard({
  type: "later-card",
  name: "Later",
  description: "Run a Home Assistant action once, at a time or in a few minutes.",
  version,
});

if (!customElements.get("later-create-form")) {
  customElements.define("later-create-form", LaterCreateForm);
}

const INSTALL_URL =
  "https://my.home-assistant.io/redirect/hacs_repository/?owner=flixlix&repository=later&category=integration";
const TICK = 30_000;

/** The dashboard's clock: Home Assistant's time zone unless the user picked the browser's. */
export function clockOf(hass: HomeAssistant): Clock {
  const locale = hass.locale as Partial<HomeAssistant["locale"]> | undefined;
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeZoneSetting: string | undefined = locale?.time_zone;
  const timeFormat: string = locale?.time_format ?? "language";
  return {
    timeZone: timeZoneSetting === "local" ? browserZone : hass.config.time_zone,
    language: locale?.language ?? hass.language,
    hour12: timeFormat === "12" ? true : timeFormat === "24" ? false : undefined,
  };
}

@customElement("later-card")
export class LaterCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: LaterCardConfig;
  /** Undefined until the subscription delivers the first list. */
  @state() private _schedules?: Schedule[];
  @state() private _error?: WebsocketError;
  @state() private _creating = false;
  @state() private _now = new Date();

  private _unsubscribe?: Promise<() => Promise<void>>;
  private _tick?: ReturnType<typeof setInterval>;

  public static getConfigElement(): LovelaceCardEditor {
    return new LaterCardEditor();
  }

  public static getStubConfig(): LaterCardConfig {
    return { type: "custom:later-card" };
  }

  public setConfig(config: LaterCardConfig): void {
    try {
      assert(config, laterCardConfigStruct);
    } catch (error) {
      throw new Error(
        error instanceof StructError
          ? `Invalid later-card config: ${error.message}`
          : String(error),
        { cause: error }
      );
    }
    this._config = config;
  }

  public getCardSize(): number {
    return 2 + (this._schedules?.length ?? 0) + (this._creating ? 6 : 0);
  }

  public connectedCallback(): void {
    super.connectedCallback();
    void loadHaForm();
    this._tick = setInterval(() => {
      this._now = new Date();
    }, TICK);
    if (this.hass) {
      this._subscribe();
    }
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._tick);
    this._unsubscribe
      ?.then((unsubscribe) => unsubscribe())
      .catch((error: unknown) => {
        console.error("Later: unsubscribing from later/subscribe failed", error);
      });
    this._unsubscribe = undefined;
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has("hass") && this.hass && !this._unsubscribe && this.isConnected) {
      this._subscribe();
    }
  }

  private _subscribe(): void {
    this._error = undefined;
    this._unsubscribe = subscribeSchedules(this.hass, (event) => {
      this._schedules = event.schedules;
    }).catch((error: unknown) => {
      this._error = websocketError(error);
      return () => Promise.resolve();
    });
  }

  protected render(): TemplateResult {
    return html`<ha-card>
      <div class="header">
        <h1>${this._config?.title ?? "Later"}</h1>
        ${
          this._schedules && !this._creating && !this._error
            ? html`<button
                class="icon"
                type="button"
                aria-label="Schedule an action"
                title="Schedule an action"
                @click=${this._openForm}
              >
                <ha-svg-icon .path=${mdiPlus}></ha-svg-icon>
              </button>`
            : nothing
        }
      </div>
      <div class="content">${this._renderContent()}</div>
    </ha-card>`;
  }

  private _renderContent() {
    if (this._error) {
      return this._renderError(this._error);
    }
    if (!this._schedules) {
      return html`<p class="muted">Loading…</p>`;
    }
    return html`${this._creating ? this._renderForm() : nothing}
    ${this._schedules.length ? this._renderList(this._schedules) : this._renderEmpty()}`;
  }

  private _renderError(error: WebsocketError) {
    if (error.code === "unknown_command") {
      return html`<div class="notice" role="alert">
        <p>
          The <b>Later</b> integration is not installed. This card only works with it. In HACS, open
          <b>Integrations</b>, add <b>Later</b>, restart Home Assistant, then add Later under
          Settings → Devices & services.
        </p>
        <a href=${INSTALL_URL} target="_blank" rel="noreferrer">Open Later in HACS</a>
      </div>`;
    }
    if (error.code === "not_loaded") {
      return html`<div class="notice" role="alert">
        <p>
          The <b>Later</b> integration is installed but not set up. Add it under Settings → Devices
          & services → Add integration → Later.
        </p>
      </div>`;
    }
    return html`<div class="notice" role="alert">
      <p>Later could not load its schedules: ${error.message || error.code}</p>
    </div>`;
  }

  private _renderForm() {
    return html`<later-create-form
      .hass=${this.hass}
      .entity=${this._config?.entity}
      .timeZone=${this.hass.config.time_zone}
      .submit=${this._submit}
      @closed=${this._closeForm}
    ></later-create-form>`;
  }

  private _renderEmpty() {
    if (this._creating) {
      return nothing;
    }
    return html`<div class="empty">
      <ha-svg-icon .path=${mdiTimerOutline}></ha-svg-icon>
      <p>Nothing scheduled</p>
      <button class="primary" type="button" @click=${this._openForm}>Schedule an action</button>
    </div>`;
  }

  private _renderList(schedules: Schedule[]) {
    const clock = clockOf(this.hass);
    return html`<ul class="list">
      ${repeat(
        schedules,
        (schedule) => schedule.id,
        (schedule) => this._renderRow(schedule, clock)
      )}
    </ul>`;
  }

  private _renderRow(schedule: Schedule, clock: Clock) {
    const runAt = new Date(schedule.run_at);
    const stateObj = schedule.entity_id ? this.hass.states[schedule.entity_id] : undefined;
    const friendlyName = stateObj?.attributes.friendly_name;
    const target =
      typeof friendlyName === "string" ? friendlyName : (schedule.entity_id ?? undefined);
    const summary = [actionSummary(schedule.service), target].filter(Boolean).join(" · ");
    return html`<li class="row" data-id=${schedule.id}>
      ${
        stateObj
          ? html`<ha-state-icon .hass=${this.hass} .stateObj=${stateObj}></ha-state-icon>`
          : html`<ha-svg-icon .path=${mdiTimerSandComplete}></ha-svg-icon>`
      }
      <div class="text">
        <span class="name">${schedule.name}</span>
        <span class="secondary">${summary}</span>
      </div>
      <div class="due">
        <span class="clock">${clockLabel(runAt, this._now, clock)}</span>
        <span class="secondary relative">${relativeLabel(runAt, this._now)}</span>
      </div>
      <button
        class="icon"
        type="button"
        aria-label=${`Cancel ${schedule.name}`}
        title="Cancel"
        @click=${() => this._cancel(schedule.id)}
      >
        <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
      </button>
    </li>`;
  }

  private _openForm = (): void => {
    this._creating = true;
  };

  private _closeForm = (): void => {
    this._creating = false;
  };

  private _submit = async (request: AddRequest): Promise<void> => {
    try {
      await addSchedule(this.hass, request);
    } catch (error) {
      throw new Error(websocketError(error).message || "Could not schedule this action", {
        cause: error,
      });
    }
  };

  private async _cancel(scheduleId: string): Promise<void> {
    try {
      await cancelSchedule(this.hass, scheduleId);
    } catch (error) {
      // Already run or cancelled elsewhere: the subscription removes the row.
      console.warn(`Later: cancelling ${scheduleId} failed`, websocketError(error));
    }
  }

  static styles = css`
    ha-card {
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px 0;
    }
    h1 {
      margin: 0;
      font-size: var(--ha-card-header-font-size, var(--ha-font-size-xl, 20px));
      font-weight: var(--ha-font-weight-normal, 400);
      color: var(--ha-card-header-color, var(--primary-text-color));
      line-height: 40px;
    }
    .content {
      padding: 8px 16px 16px;
    }
    button {
      font: inherit;
      cursor: pointer;
    }
    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 50%;
      background: none;
      color: var(--secondary-text-color);
      padding: 0;
      flex: none;
    }
    .icon:hover {
      background: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
    }
    .primary {
      border: none;
      border-radius: 18px;
      padding: 8px 16px;
      background: var(--primary-color);
      color: var(--text-primary-color, #fff);
      font-weight: var(--ha-font-weight-medium, 500);
    }
    .muted,
    .secondary {
      color: var(--secondary-text-color);
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    later-create-form + .list {
      margin-top: 16px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 48px;
    }
    .row + .row {
      border-top: 1px solid var(--divider-color, #e0e0e0);
    }
    .row > ha-svg-icon,
    .row > ha-state-icon {
      color: var(--state-icon-color, var(--secondary-text-color));
      flex: none;
    }
    .text,
    .due {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .text {
      flex: 1;
    }
    .due {
      align-items: flex-end;
      text-align: right;
      white-space: nowrap;
    }
    .name,
    .secondary {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .secondary {
      font-size: var(--ha-font-size-s, 12px);
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      color: var(--secondary-text-color);
    }
    .empty p {
      margin: 0;
    }
    .notice {
      border-left: 4px solid var(--warning-color, #ffa600);
      padding: 4px 12px;
    }
    .notice p {
      margin: 0 0 8px;
    }
    .notice a {
      color: var(--primary-color);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "later-card": LaterCard;
  }
}
