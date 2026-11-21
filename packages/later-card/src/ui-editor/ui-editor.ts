import { loadHaForm } from "@later/shared/ui-editor/load-ha-form";
import { fireEvent, type HomeAssistant, type LovelaceCardEditor } from "custom-card-helpers";
import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { type LaterCardConfig } from "../types";

const SCHEMA = [
  { name: "title", selector: { text: {} } },
  { name: "entity", selector: { entity: {} } },
];

const LABELS: Record<string, string> = {
  title: "Title",
  entity: "Default entity (preselected when scheduling)",
};

const computeLabel = (schema: { name: string }): string => LABELS[schema.name] ?? schema.name;

@customElement("later-card-editor")
export class LaterCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: LaterCardConfig;

  public setConfig(config: LaterCardConfig): void {
    this._config = config;
  }

  public connectedCallback(): void {
    super.connectedCallback();
    void loadHaForm().then(() => this.requestUpdate());
  }

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }
    return html`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${SCHEMA}
      .computeLabel=${computeLabel}
      @value-changed=${this._valueChanged}
    ></ha-form>`;
  }

  private _valueChanged = (event: CustomEvent<{ value: Record<string, unknown> }>): void => {
    const value = event.detail.value;
    const config: LaterCardConfig = { type: this._config?.type ?? "custom:later-card" };
    if (typeof value.title === "string" && value.title !== "") {
      config.title = value.title;
    }
    if (typeof value.entity === "string" && value.entity !== "") {
      config.entity = value.entity;
    }
    this._config = config;
    fireEvent(this, "config-changed", { config });
  };
}
