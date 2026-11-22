import {
  mdiBlindsHorizontal,
  mdiCircleOutline,
  mdiClose,
  mdiCoffeeMaker,
  mdiFan,
  mdiLightbulb,
  mdiPowerPlug,
  mdiScriptText,
  mdiTelevision,
  mdiThermostat,
  mdiToggleSwitchOutline,
} from "@mdi/js";
import { type HomeAssistant } from "custom-card-helpers";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { property, query } from "lit/decorators.js";

// The parts of Home Assistant's frontend the card borrows and the docs have to stand in for: the
// dialog the create form opens in, the form fields, and state icons. Styled with Home Assistant's
// theme variables so they look like the real thing next to the card.

/** `ha-dialog`: a modal with a close button and a title; fires `closed` when dismissed. */
class HaDialog extends LitElement {
  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) headerTitle = "";
  @property({ attribute: false }) heading = "";
  @query("dialog") private _dialog?: HTMLDialogElement;

  protected updated(): void {
    if (this.open && this._dialog && !this._dialog.open) {
      this._dialog.showModal();
    }
  }

  private _close = () => this._dialog?.close();

  private _closed = () => {
    this.open = false;
    this.dispatchEvent(new Event("closed"));
  };

  private _clickBackdrop = (event: MouseEvent) => {
    if (event.target === this._dialog) {
      this._close();
    }
  };

  render() {
    return html`<dialog autofocus @close=${this._closed} @click=${this._clickBackdrop}>
      <header>
        <button type="button" class="close" aria-label="Close" @click=${this._close}>
          <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
        </button>
        <h2>${this.headerTitle || this.heading}</h2>
      </header>
      <div class="content"><slot></slot></div>
    </dialog>`;
  }

  static styles = css`
    dialog {
      box-sizing: border-box;
      width: min(560px, calc(100vw - 32px));
      max-height: calc(100vh - 64px);
      padding: 0;
      border: none;
      border-radius: var(--ha-border-radius-3xl, 24px);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      font-family: var(--ha-font-family-body, Roboto, sans-serif);
      box-shadow: 0 8px 32px rgb(0 0 0 / 0.24);
    }
    dialog:focus {
      outline: none;
    }
    dialog::backdrop {
      background: rgb(0 0 0 / 0.2);
      backdrop-filter: var(--ha-dialog-scrim-backdrop-filter, brightness(68%));
    }
    header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px 4px 8px;
    }
    h2 {
      margin: 0;
      font-size: var(--ha-font-size-xl, 20px);
      font-weight: var(--ha-font-weight-normal, 400);
    }
    .close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border: none;
      border-radius: 50%;
      background: none;
      color: var(--primary-text-color);
      cursor: pointer;
    }
    .close:hover {
      background: var(--ha-color-fill-neutral-quiet-hover, rgb(0 0 0 / 0.06));
    }
    .content {
      padding: 8px 24px 24px;
    }
  `;
}

type Selector = Record<string, Record<string, unknown> | undefined>;
type SchemaItem = { name: string; selector: Selector };
type Option = { value: string; label: string };

const isOption = (value: unknown): value is Option =>
  typeof value === "object" && value !== null && "value" in value && "label" in value;

/** The object selector's text: one `key: value` per line, as in YAML. */
const objectText = (value: unknown) =>
  typeof value === "object" && value !== null
    ? Object.entries(value)
        .map(
          ([key, field]) => `${key}: ${typeof field === "string" ? field : JSON.stringify(field)}`
        )
        .join("\n")
    : "";

const fieldValue = (event: Event): string => {
  const field = event.target;
  return field instanceof HTMLInputElement ||
    field instanceof HTMLSelectElement ||
    field instanceof HTMLTextAreaElement
    ? field.value
    : "";
};

const parseScalar = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const parseObject = (text: string) =>
  Object.fromEntries(
    text
      .split("\n")
      .map((line) => /^\s*([\w.-]+)\s*:\s*(.*)$/.exec(line))
      .filter((match) => match !== null)
      .map(([, key = "", value = ""]) => [key, parseScalar(value.trim())])
  );

/**
 * `ha-form` with the selectors the card uses: entity, text, select, object, number, date and time.
 * Reports changes as Home Assistant does: `value-changed` with the whole data in `detail.value`.
 */
class HaForm extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) data: Record<string, unknown> = {};
  @property({ attribute: false }) schema: SchemaItem[] = [];
  @property({ attribute: false }) computeLabel?: (item: SchemaItem) => string;

  private _change(name: string, value: unknown) {
    this.dispatchEvent(
      new CustomEvent("value-changed", {
        detail: { value: { ...this.data, [name]: value } },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _field({ name, selector }: SchemaItem) {
    const value = this.data[name];
    const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
    const onInput = (event: Event) => this._change(name, fieldValue(event));
    if (selector.entity) {
      return this._entityField(text, onInput);
    }
    if (selector.select) {
      const options = Array.isArray(selector.select.options)
        ? selector.select.options.filter(isOption)
        : [];
      return html`<input list="options" .value=${text} @change=${onInput} />
        <datalist id="options">
          ${options.map((option) => html`<option value=${option.value}></option>`)}
        </datalist>`;
    }
    if (selector.object) {
      return html`<textarea
        rows="3"
        placeholder="temperature: 18"
        .value=${objectText(value)}
        @change=${(event: Event) => this._change(name, parseObject(fieldValue(event)))}
      ></textarea>`;
    }
    if (selector.number) {
      return this._numberField(name, text, selector.number);
    }
    if (selector.date || selector.time) {
      return html`<input
        type=${selector.date ? "date" : "time"}
        .value=${selector.time ? text.slice(0, 5) : text}
        @change=${onInput}
      />`;
    }
    return html`<input .value=${text} @input=${onInput} />`;
  }

  private _entityField(text: string, onInput: (event: Event) => void) {
    const entities = Object.values(this.hass?.states ?? {}).toSorted((a, b) =>
      String(a.attributes.friendly_name).localeCompare(String(b.attributes.friendly_name))
    );
    return html`<select @change=${onInput}>
      <option value="" ?selected=${!text}></option>
      ${entities.map(
        (entity) =>
          html`<option value=${entity.entity_id} ?selected=${entity.entity_id === text}>
            ${entity.attributes.friendly_name ?? entity.entity_id}
          </option>`
      )}
    </select>`;
  }

  private _numberField(name: string, text: string, options: Record<string, unknown>) {
    const bound = (key: string) => (typeof options[key] === "number" ? String(options[key]) : "");
    const unit = options.unit_of_measurement;
    return html`<div class="suffixed">
      <input
        type="number"
        min=${bound("min")}
        max=${bound("max")}
        .value=${text}
        @input=${(event: Event) => this._change(name, Number(fieldValue(event)))}
      />
      <span>${typeof unit === "string" ? unit : nothing}</span>
    </div>`;
  }

  render() {
    return this.schema.map(
      (item) =>
        html`<label>
          <span class="label">${this.computeLabel?.(item) ?? item.name}</span>
          ${this._field(item)}
        </label>`
    );
  }

  static styles = css`
    :host {
      display: block;
    }
    label {
      display: flex;
      flex-direction: column;
      padding: 6px 12px 0;
      border-bottom: 1px solid var(--secondary-text-color);
      border-radius: 4px 4px 0 0;
      background: var(--input-fill-color, #f5f5f5);
    }
    label:focus-within {
      border-bottom: 2px solid var(--primary-color);
    }
    label:focus-within .label {
      color: var(--primary-color);
    }
    .label {
      color: var(--secondary-text-color);
      font-size: var(--ha-font-size-s, 12px);
    }
    input,
    select,
    textarea {
      box-sizing: border-box;
      width: 100%;
      min-height: 36px;
      padding: 4px 0 8px;
      border: none;
      background: none;
      color: var(--primary-text-color);
      font: inherit;
      font-size: var(--ha-font-size-l, 16px);
      outline: none;
      color-scheme: inherit;
    }
    textarea {
      resize: vertical;
      font-family: var(--ha-font-family-code, monospace);
      font-size: var(--ha-font-size-m, 14px);
    }
    select option {
      background: var(--card-background-color);
    }
    .suffixed {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--secondary-text-color);
    }
  `;
}

const DOMAIN_ICONS: Record<string, string> = {
  light: mdiLightbulb,
  switch: mdiPowerPlug,
  fan: mdiFan,
  climate: mdiThermostat,
  cover: mdiBlindsHorizontal,
  media_player: mdiTelevision,
  script: mdiScriptText,
  input_boolean: mdiToggleSwitchOutline,
};

const ACTIVE_COLORS: Record<string, string> = {
  light: "var(--state-light-active-color)",
  switch: "var(--state-switch-active-color)",
  fan: "var(--state-fan-active-color)",
  climate: "var(--state-climate-heat-color)",
  input_boolean: "var(--state-active-color)",
};

const INACTIVE = new Set(["off", "closed", "idle", "standby", "unavailable"]);

/** `ha-state-icon`: the entity's icon or its domain's, coloured while it is on. */
class HaStateIcon extends LitElement {
  @property({ attribute: false }) stateObj?: {
    entity_id: string;
    state: string;
    attributes: Record<string, unknown>;
  };

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("stateObj")) {
      const domain = this.stateObj?.entity_id.split(".")[0] ?? "";
      const active = this.stateObj && !INACTIVE.has(this.stateObj.state);
      this.style.color = (active ? ACTIVE_COLORS[domain] : undefined) ?? "var(--state-icon-color)";
    }
  }

  render() {
    const domain = this.stateObj?.entity_id.split(".")[0] ?? "";
    const icon = this.stateObj?.entity_id === "switch.coffee_machine" ? mdiCoffeeMaker : undefined;
    return html`<ha-svg-icon
      .path=${icon ?? DOMAIN_ICONS[domain] ?? mdiCircleOutline}
    ></ha-svg-icon>`;
  }

  static styles = css`
    :host {
      display: inline-flex;
    }
  `;
}

/** Defined before `defineHaElements`, which then keeps these and adds the rest. */
export function defineDocsHaElements(): void {
  const elements: [string, CustomElementConstructor][] = [
    ["ha-dialog", HaDialog],
    ["ha-form", HaForm],
    ["ha-state-icon", HaStateIcon],
  ];
  for (const [tag, element] of elements) {
    if (!customElements.get(tag)) {
      customElements.define(tag, element);
    }
  }
}
