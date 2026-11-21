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
import { type Localize, localizer } from "./localize";
import { actionSummary } from "./request";
import { type Clock, clockLabel, msToNextMinute, relativeLabel } from "./time";
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
  updateSchedule,
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

/**
 * The dashboard's clock: Home Assistant's time zone, the one the integration reads times in and
 * names schedules with, and the user's 12- or 24-hour setting.
 */
export function clockOf(hass: HomeAssistant): Clock {
  const locale = hass.locale as Partial<HomeAssistant["locale"]> | undefined;
  const timeFormat: string = locale?.time_format ?? "language";
  return {
    timeZone: hass.config.time_zone,
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
  /** Whether the dialog with the create form is open. */
  @state() private _creating = false;
  /** The schedule the dialog edits; undefined while creating one. */
  @state() private _editing?: Schedule;
  @state() private _now = new Date();

  private _unsubscribe?: Promise<() => Promise<void>>;
  private _tick?: ReturnType<typeof setTimeout>;

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
    return 2 + (this._schedules?.length ?? 0);
  }

  public connectedCallback(): void {
    super.connectedCallback();
    void loadHaForm();
    this._tickEachMinute();
    if (this.hass) {
      this._subscribe();
    }
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._tick);
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

  /** Labels change by the minute: wake once at each minute boundary, not on an interval. */
  private _tickEachMinute(): void {
    this._tick = setTimeout(() => {
      this._now = new Date();
      this._tickEachMinute();
    }, msToNextMinute(new Date()));
  }

  private _subscribe(): void {
    this._error = undefined;
    this._unsubscribe = subscribeSchedules(this.hass, (event) => {
      this._now = new Date();
      this._schedules = event.schedules;
    }).catch((error: unknown) => {
      this._error = websocketError(error);
      return () => Promise.resolve();
    });
  }

  private get _localize(): Localize {
    return localizer(clockOf(this.hass).language);
  }

  protected render(): TemplateResult {
    const t = this._localize;
    return html`<ha-card>
      <div class="header">
        <h1>${this._config?.title ?? t("card.title")}</h1>
        ${
          this._schedules && !this._error
            ? html`<button
                class="icon"
                type="button"
                aria-label=${t("card.schedule_action")}
                title=${t("card.schedule_action")}
                @click=${() => this._openForm()}
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
      return html`<p class="muted">${this._localize("card.loading")}</p>`;
    }
    return html`${this._creating ? this._renderDialog() : nothing}
    ${this._schedules.length ? this._renderList(this._schedules) : this._renderEmpty()}`;
  }

  private _renderError(error: WebsocketError) {
    const t = this._localize;
    if (error.code === "unknown_command") {
      return html`<div class="notice" role="alert">
        <p>${t("card.not_installed")}</p>
        <a href=${INSTALL_URL} target="_blank" rel="noreferrer">${t("card.open_in_hacs")}</a>
      </div>`;
    }
    if (error.code === "not_loaded") {
      return html`<div class="notice" role="alert">
        <p>${t("card.not_set_up")}</p>
      </div>`;
    }
    return html`<div class="notice" role="alert">
      <p>${t("card.load_failed", { error: error.message || error.code })}</p>
    </div>`;
  }

  private _renderDialog() {
    const title = this._localize(this._editing ? "card.edit_schedule" : "card.schedule_action");
    // `headerTitle` for Home Assistant's current dialog, `heading` for the one before it.
    return html`<ha-dialog
      open
      .headerTitle=${title}
      .heading=${title}
      @closed=${this._dialogClosed}
    >
      <later-create-form
        .hass=${this.hass}
        .entity=${this._config?.entity}
        .schedule=${this._editing}
        .clock=${clockOf(this.hass)}
        .submit=${this._submit}
        @closed=${this._closeForm}
      ></later-create-form>
    </ha-dialog>`;
  }

  private _renderEmpty() {
    return html`<div class="empty">
      <ha-svg-icon .path=${mdiTimerOutline}></ha-svg-icon>
      <p>${this._localize("card.nothing_scheduled")}</p>
      <button class="primary" type="button" @click=${() => this._openForm()}>
        ${this._localize("card.schedule_action")}
      </button>
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
    const t = this._localize;
    const runAt = new Date(schedule.run_at);
    const stateObj = schedule.entity_id ? this.hass.states[schedule.entity_id] : undefined;
    const friendlyName = stateObj?.attributes.friendly_name;
    const target =
      typeof friendlyName === "string" ? friendlyName : (schedule.entity_id ?? undefined);
    const summary = [actionSummary(schedule.service, t), target].filter(Boolean).join(" · ");
    return html`<li class="row" data-id=${schedule.id}>
      ${
        stateObj
          ? html`<ha-state-icon .hass=${this.hass} .stateObj=${stateObj}></ha-state-icon>`
          : html`<ha-svg-icon .path=${mdiTimerSandComplete}></ha-svg-icon>`
      }
      <button
        class="open"
        type="button"
        aria-label=${t("card.edit_named", { name: schedule.name })}
        title=${t("card.edit")}
        @click=${() => this._openForm(schedule)}
      >
        <span class="text">
          <span class="name">${schedule.name}</span>
          <span class="secondary">${summary}</span>
        </span>
        <span class="due">
          <span class="clock">${clockLabel(runAt, this._now, clock)}</span>
          <span class="secondary relative"
            >${relativeLabel(runAt, this._now, clock.language, t)}</span
          >
        </span>
      </button>
      <button
        class="icon"
        type="button"
        aria-label=${t("card.cancel_named", { name: schedule.name })}
        title=${t("card.cancel")}
        @click=${() => this._cancel(schedule.id)}
      >
        <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
      </button>
    </li>`;
  }

  private _openForm = (schedule?: Schedule): void => {
    this._editing = schedule;
    this._creating = true;
  };

  /** Escape, the scrim or the close button; ignores `closed` from menus inside the form. */
  private _dialogClosed = (event: Event): void => {
    if (event.target === event.currentTarget) {
      this._closeForm();
    }
  };

  private _closeForm = (): void => {
    this._creating = false;
    this._editing = undefined;
  };

  private _submit = async (request: AddRequest): Promise<void> => {
    const editing = this._editing;
    try {
      await (editing
        ? updateSchedule(this.hass, editing.id, request)
        : addSchedule(this.hass, request));
    } catch (error) {
      const fallback = editing
        ? this._localize("card.could_not_save", { name: editing.name })
        : this._localize("card.could_not_schedule");
      throw new Error(websocketError(error).message || fallback, { cause: error });
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
    .open {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      border: none;
      background: none;
      color: inherit;
      padding: 4px 0;
      text-align: left;
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
