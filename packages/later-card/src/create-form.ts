import { type HomeAssistant } from "custom-card-helpers";
import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";
import { addRequest, type Draft, shortcutLabel, shortcutsFor, type When } from "./request";
import { clockTimeDay, nextFullHour } from "./time";
import { type AddRequest, type Shortcut } from "./types";

type FormValue = Record<string, unknown>;

const MINUTE_CHIPS = [15, 30, 60];

const LABELS: Record<string, string> = {
  entity_id: "Entity",
  service: "Service",
  data: "Service data",
  minutes: "Minutes",
  time: "Time",
  name: "Name (optional)",
};

const computeLabel = (schema: { name: string }): string => LABELS[schema.name] ?? schema.name;

const minutesLabel = (minutes: number): string =>
  minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;

const isRecord = (value: unknown): value is FormValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The value an `ha-form` reports in its `value-changed` event. */
const formValue = (event: Event): FormValue =>
  event instanceof CustomEvent && isRecord(event.detail) && isRecord(event.detail.value)
    ? event.detail.value
    : {};

const stringField = (value: FormValue, key: string): string | undefined => {
  const field = value[key];
  return typeof field === "string" && field !== "" ? field : undefined;
};

/**
 * `<later-create-form>`: pick an entity, an action and when, then confirm. Hands the `later/add` payload to `submit`
 * and shows its error, if any.
 */
export class LaterCreateForm extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public submit!: (request: AddRequest) => Promise<void>;
  @property({ attribute: false }) public entity?: string;
  /** Time zone clock times are picked in: Home Assistant's. */
  @property({ attribute: false }) public timeZone = "UTC";

  @state() private _draft: Draft = {};
  @state() private _customMinutes = false;
  @state() private _error?: string;
  @state() private _busy = false;

  public connectedCallback(): void {
    super.connectedCallback();
    if (this.entity && !this._draft.entity) {
      this._setEntity(this.entity);
    }
  }

  protected render(): TemplateResult {
    return html`
      <div class="form">
        ${this._field("entity_id", { entity: {} }, { entity_id: this._draft.entity ?? "" }, (v) =>
          this._setEntity(stringField(v, "entity_id"))
        )}
        <div class="group" role="group" aria-label="Action">${this._actionChips()}</div>
        ${this._draft.action === "service" ? this._serviceFields() : nothing}
        <div class="group" role="group" aria-label="When">${this._whenChips()}</div>
        ${this._whenField()}
        ${this._field("name", { text: {} }, { name: this._draft.name ?? "" }, (v) =>
          this._update({ name: stringField(v, "name") })
        )}
        ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : nothing}
        <div class="actions">
          <button class="text" type="button" @click=${this._cancel}>Cancel</button>
          <button class="primary" type="button" ?disabled=${this._busy} @click=${this._confirm}>
            Schedule
          </button>
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
      .computeLabel=${computeLabel}
      @value-changed=${(event: Event) => onChange(formValue(event))}
    ></ha-form>`;
  }

  private _chip(label: string, pressed: boolean, onClick: () => void, name: string) {
    return html`<button
      class="chip"
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
      this._chip(
        shortcutLabel(shortcut),
        this._draft.action === shortcut,
        () => this._update({ action: shortcut }),
        shortcut
      )
    )}
    ${this._chip(
      shortcuts.length ? "Other service" : "Service",
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
        minutesLabel(minutes),
        !this._customMinutes && when?.kind === "in" && when.minutes === minutes,
        () => this._setWhen({ kind: "in", minutes }, false),
        `in-${minutes}`
      )
    );
    return html`${minutesChips}
    ${this._chip(
      "Other",
      this._customMinutes && when?.kind === "in",
      () => this._setWhen({ kind: "in", minutes: when?.kind === "in" ? when.minutes : 45 }, true),
      "in-custom"
    )}
    ${this._chip(
      "At time",
      when?.kind === "at",
      () => this._setWhen({ kind: "at", time: nextFullHour(new Date(), this.timeZone) }, false),
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
      const day = clockTimeDay(when.time, new Date(), this.timeZone);
      return html`${this._field("time", { time: { no_second: true } }, { time: when.time }, (v) =>
          this._setWhen({ kind: "at", time: stringField(v, "time") ?? when.time }, false)
        )}
        <p class="hint">Runs ${day} at ${when.time.slice(0, 5)}</p>`;
    }
    return nothing;
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
    const request = addRequest(this._draft);
    if (typeof request === "string") {
      this._error = request;
      return;
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
    .group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    button {
      font: inherit;
      cursor: pointer;
    }
    .chip {
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 16px;
      background: none;
      color: var(--primary-text-color);
      padding: 6px 12px;
      font-size: var(--ha-font-size-s, 12px);
      font-weight: var(--ha-font-weight-medium, 500);
    }
    .chip[aria-pressed="true"] {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: var(--text-primary-color, #fff);
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
    .text,
    .primary {
      border: none;
      border-radius: 18px;
      padding: 8px 16px;
      font-weight: var(--ha-font-weight-medium, 500);
    }
    .text {
      background: none;
      color: var(--primary-color);
    }
    .primary {
      background: var(--primary-color);
      color: var(--text-primary-color, #fff);
    }
    .primary[disabled] {
      opacity: 0.5;
      cursor: default;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "later-create-form": LaterCreateForm;
  }
}
