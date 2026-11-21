import { registerCustomCard } from "@later/shared/utils/register-custom-card";
import { type HomeAssistant, type LovelaceCard } from "custom-card-helpers";
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { version } from "../package.json";

registerCustomCard({
  type: "later-card",
  name: "Later",
  description: "Run a Home Assistant action once, later.",
  version,
});

type LaterCardConfig = { type: string; title?: string };

@customElement("later-card")
export class LaterCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: LaterCardConfig;

  public setConfig(config: LaterCardConfig): void {
    this._config = config;
  }

  public getCardSize(): number {
    return 2;
  }

  protected render() {
    return html`<ha-card .header=${this._config?.title}></ha-card>`;
  }
}
