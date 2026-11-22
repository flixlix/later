import { type HomeAssistant } from "custom-card-helpers";
import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { type Localize, localizer } from "./localize";
import { addRequest, type Draft, draftOf, shortcutLabel, shortcutsFor, type When } from "./request";
import {
  type Clock,
  clockLabel,
  dayKey,
  dayWord,
  durationLabel,
  hasPassed,
  nextFullHour,
  relativeLabel,
  zonedMoment,
} from "./time";
import { type AddRequest, type Schedule, type Shortcut } from "./types";

type FormValue = Record<string, unknown>;

const MINUTE_CHIPS = [15, 30, 60];

/** Translation keys of the `ha-form` field labels. */
const LABELS: Record<string, string> = {
  entity_id: "form.entity",
  service: "form.service",
  data: "form.data",
  minutes: "form.minutes",
  date: "form.date",
  time: "form.time",
  name: "form.name",
};

const isRecord = (value: unknown): value is FormValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The value an `ha-form` reports in its `value-changed` event: a plain `Event` with `detail`
 * assigned by Home Assistant's `fireEvent`, not a `CustomEvent`.
 */
const formValue = (event: Event): FormValue =>
  "detail" in event && isRecord(event.detail) && isRecord(event.detail.value)
    ? event.detail.value
    : {};

const stringField = (value: FormValue, key: string): string | undefined => {
  const field = value[key];
  return typeof field === "string" && field !== "" ? field : undefined;
};

/**
 * `<later-create-form>`: pick an entity, an action and when, then confirm. Creates a schedule, or
 * edits `schedule` when given. Hands the payload to `submit` and shows its error, if any.
 */
export class LaterCreateForm extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public submit!: (request: AddRequest) => Promise<void>;
  @property({ attribute: false }) public entity?: string;
  /** The schedule to edit; a new one without. */
  @property({ attribute: false }) public schedule?: Schedule;
  /** The dashboard's clock: dates and times are picked and shown on it. */
  @property({ attribute: false }) public clock: Clock = { timeZone: "UTC", language: "en" };

  @state() private _draft: Draft = {};
  @state() private _customMinutes = false;
  @state() private _error?: string;
  @state() private _busy = false;

  private get _localize(): Localize {
    return localizer(this.clock.language);
  }

  private _computeLabel = (schema: { name: string }): string => {
    const key = LABELS[schema.name];
    return key ? this._localize(key) : schema.name;
  };

  public connectedCallback(): void {
    super.connectedCallback();
    if (this.schedule && !this._draft.when) {
      this._draft = draftOf(this.schedule, this.clock.timeZone);
    } else if (this.entity && !this._draft.entity) {
      this._setEntity(this.entity);
    }
  }

  protected render(): TemplateResult {
    const t = this._localize;
    return html`
      <div class="form">
        ${this._field("entity_id", { entity: {} }, { entity_id: this._draft.entity ?? "" }, (v) =>
          this._setEntity(stringField(v, "entity_id"))
        )}
        <div class="section">
          <span class="label" id="action-label">${t("form.action")}</span>
          <div class="segmented" role="group" aria-labelledby="action-label">
            ${this._actionChips()}
          </div>
        </div>
        ${this._draft.action === "service" ? this._serviceFields() : nothing}
        <div class="section">
          <span class="label" id="when-label">${t("form.when")}</span>
          <ha-chip-set role="group" aria-labelledby="when-label">${this._whenChips()}</ha-chip-set>
        </div>
        ${this._whenField()}
        ${this._field("name", { text: {} }, { name: this._draft.name ?? "" }, (v) =>
          this._update({ name: stringField(v, "name") })
        )}
        ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : nothing}
        <div class="actions">
          <ha-button appearance="plain" @click=${this._cancel}>${t("form.cancel")}</ha-button>
          <ha-button class="confirm" .loading=${this._busy} @click=${this._confirm}>
            ${t(this.schedule ? "form.save" : "form.schedule")}
          </ha-button>
        </div>
      </div>
    `;
  }

  private _field(
    name: string,
    selector: Record<string, unknown>,
    data: FormValue,
    onChange: (value: FormValue) => void
  ): TemplateResult {
    return html`<ha-form
      data-field=${name}
      .hass=${this.hass}
      .data=${data}
      .schema=${[{ name, selector }]}
      .computeLabel=${this._computeLabel}
      @value-changed=${(event: Event) => onChange(formValue(event))}
    ></ha-form>`;
  }

  /** One of the "When" choices, a Home Assistant filter chip. */
  private _chip(label: string, selected: boolean, onClick: () => void, name: string) {
    // live: the chip toggles itself on click; re-apply ours even when it did not change.
    return html`<ha-filter-chip
      data-chip=${name}
      .label=${label}
      .selected=${live(selected)}
      @click=${onClick}
    ></ha-filter-chip>`;
  }

  /** One option of the action's segmented control. */
  private _segment(label: string, pressed: boolean, onClick: () => void, name: string) {
    return html`<button
      class="segment"
      type="button"
      data-chip=${name}
      aria-pressed=${pressed ? "true" : "false"}
      @click=${onClick}
    >
      ${label}
    </button>`;
  }

  private _actionChips() {
    const shortcuts = shortcutsFor(this._draft.entity, this.hass.services);
    return html`${shortcuts.map((shortcut) =>
      this._segment(
        shortcutLabel(shortcut, this._localize),
        this._draft.action === shortcut,
        () => this._update({ action: shortcut }),
        shortcut
      )
    )}
    ${this._segment(
      this._localize(shortcuts.length ? "form.other_service" : "form.service"),
      this._draft.action === "service",
      () => this._update({ action: "service" }),
      "service"
    )}`;
  }

  private _serviceFields() {
    const options = Object.keys(this.hass.services)
      .flatMap((domain) =>
        Object.keys(this.hass.services[domain] ?? {}).map((service) => `${domain}.${service}`)
      )
      .map((value) => ({ value, label: value }));
    return html`${this._field(
      "service",
      { select: { options, mode: "dropdown", custom_value: true, sort: true } },
      { service: this._draft.service ?? "" },
      (v) => this._update({ service: stringField(v, "service") })
    )}
    ${this._field("data", { object: {} }, { data: this._draft.data ?? {} }, (v) => {
      this._update({ data: isRecord(v.data) ? v.data : {} });
    })}`;
  }

  private _whenChips() {
    const when = this._draft.when;
    const minutesChips = MINUTE_CHIPS.map((minutes) =>
      this._chip(
        this._localize("form.in", { duration: durationLabel(minutes, this.clock.language) }),
        !this._customMinutes && when?.kind === "in" && when.minutes === minutes,
        () => this._setWhen({ kind: "in", minutes }, false),
        `in-${minutes}`
      )
    );
    return html`${minutesChips}
    ${this._chip(
      this._localize("form.custom"),
      this._customMinutes && when?.kind === "in",
      () => this._setWhen({ kind: "in", minutes: when?.kind === "in" ? when.minutes : 45 }, true),
      "in-custom"
    )}
    ${this._chip(
      this._localize("form.date_time"),
      when?.kind === "at",
      () =>
        this._setWhen(
          when?.kind === "at"
            ? when
            : { kind: "at", ...nextFullHour(new Date(), this.clock.timeZone) },
          false
        ),
      "at"
    )}`;
  }

  private _whenField() {
    const when = this._draft.when;
    if (when?.kind === "in" && this._customMinutes) {
      return this._field(
        "minutes",
        { number: { min: 1, max: 10080, mode: "box", unit_of_measurement: "min" } },
        { minutes: when.minutes },
        (v) => this._setWhen({ kind: "in", minutes: Number(v.minutes) }, true)
      );
    }
    if (when?.kind === "at") {
      return html`${this._field("date", { date: {} }, { date: when.date }, (v) =>
          this._patchDueTime({ date: stringField(v, "date") })
        )}
        ${this._field("time", { time: { no_second: true } }, { time: when.time }, (v) =>
          this._patchDueTime({ time: stringField(v, "time") })
        )}
        <p class="hint">${this._dueHint(when.date, when.time)}</p>`;
    }
    return nothing;
  }

  /** `Runs tomorrow 07:30, in 12 h 30 min` on the dashboard's clock. */
  private _dueHint(date: string, time: string): string {
    const moment = zonedMoment(date, time, this.clock.timeZone);
    if (!moment) {
      return "";
    }
    const now = new Date();
    if (hasPassed(moment, now)) {
      return this._localize("form.passed");
    }
    const { language, timeZone } = this.clock;
    const today = dayKey(moment, timeZone) === dayKey(now, timeZone);
    const when = clockLabel(moment, now, this.clock);
    return this._localize("form.runs", {
      when: today ? `${dayWord(0, language)} ${when}` : when,
      relative: relativeLabel(moment, now, language, this._localize),
    });
  }

  private _setEntity(entity: string | undefined) {
    const shortcuts = shortcutsFor(entity, this.hass.services);
    const action =
      this._draft.action === "service"
        ? "service"
        : this._preferredShortcut(shortcuts, this._draft.action);
    this._update({ entity, action });
  }

  private _preferredShortcut(shortcuts: Shortcut[], current: Draft["action"]) {
    if (current && current !== "service" && shortcuts.includes(current)) {
      return current;
    }
    return shortcuts.includes("turn_off") ? "turn_off" : shortcuts[0];
  }

  /** Changes the date or the time; a cleared field keeps what it held. */
  private _patchDueTime(patch: { date?: string; time?: string }) {
    const when = this._draft.when;
    if (when?.kind === "at") {
      this._setWhen(
        { kind: "at", date: patch.date ?? when.date, time: patch.time ?? when.time },
        false
      );
    }
  }

  private _setWhen(when: When, custom: boolean) {
    this._customMinutes = custom;
    this._update({ when });
  }

  private _update(patch: Partial<Draft>) {
    this._draft = { ...this._draft, ...patch };
    this._error = undefined;
  }

  private _cancel = (): void => {
    this.dispatchEvent(new CustomEvent("closed", { bubbles: true, composed: true }));
  };

  private _confirm = async (): Promise<void> => {
    const request = addRequest(this._draft, new Date(), this.clock.timeZone);
    if (typeof request === "string") {
      this._error = this._localize(request);
      return;
    }
    if (this.schedule && request.name === this.schedule.name) {
      // Unchanged: the integration then renames a default-named schedule to match the edit.
      delete request.name;
    }
    this._busy = true;
    try {
      await this.submit(request);
      this._draft = this.entity ? { entity: this.entity } : {};
      this._customMinutes = false;
      this._cancel();
    } catch (error) {
      this._error = error instanceof Error ? error.message : String(error);
    } finally {
      this._busy = false;
    }
  };

  static styles = css`
    .form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .label {
      color: var(--secondary-text-color);
      font-size: var(--ha-font-size-s, 12px);
      font-weight: var(--ha-font-weight-medium, 500);
    }
    .segmented {
      display: flex;
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 8px;
      overflow: hidden;
    }
    .segment {
      flex: 1 1 0;
      min-width: 0;
      border: none;
      background: none;
      color: var(--primary-text-color);
      padding: 8px 6px;
      font-size: var(--ha-font-size-m, 14px);
      overflow-wrap: anywhere;
    }
    .segment + .segment {
      border-left: 1px solid var(--divider-color, #e0e0e0);
    }
    .segment[aria-pressed="true"] {
      background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.15);
      color: var(--primary-color);
      font-weight: var(--ha-font-weight-medium, 500);
    }
    button {
      font: inherit;
      cursor: pointer;
    }
    .hint {
      margin: -4px 0 0;
      color: var(--secondary-text-color);
      font-size: var(--ha-font-size-s, 12px);
    }
    .error {
      margin: 0;
      color: var(--error-color, #db4437);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "later-create-form": LaterCreateForm;
  }
}
