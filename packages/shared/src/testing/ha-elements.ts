import { mdiCheckboxBlankCircleOutline } from "@mdi/js";
import { css, html, LitElement, nothing, svg } from "lit";
import { property } from "lit/decorators.js";
import { haThemeDark, haThemeLight } from "./ha-theme";

// Styles copied from the Home Assistant frontend (Apache-2.0), as served by Home Assistant 2026.11.

class HaCard extends LitElement {
  @property() header?: string;

  render() {
    return html`${this.header ? html`<h1 class="card-header">${this.header}</h1>` : nothing}<slot
      ></slot>`;
  }

  static styles = css`
    :host {
      background: var(--ha-card-background, var(--card-background-color, white));
      box-shadow: var(--ha-card-box-shadow, none);
      box-sizing: border-box;
      border-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg));
      border-width: var(--ha-card-border-width, 1px);
      border-style: solid;
      border-color: var(--ha-card-border-color, var(--divider-color, #e0e0e0));
      color: var(--primary-text-color);
      position: relative;
      display: block;
    }
  `;
}

class HaSvgIcon extends LitElement {
  @property() path?: string;

  render() {
    return html`<svg viewBox="0 0 24 24" focusable="false" role="img" aria-hidden="true">
      <g>${this.path ? svg`<path d=${this.path}></path>` : nothing}</g>
    </svg>`;
  }

  static styles = css`
    :host {
      display: var(--ha-icon-display, inline-flex);
      align-items: center;
      justify-content: center;
      position: relative;
      vertical-align: middle;
      fill: var(--icon-primary-color, currentcolor);
      width: var(--mdc-icon-size, 24px);
      height: var(--mdc-icon-size, 24px);
    }
    svg {
      width: 100%;
      height: 100%;
      pointer-events: none;
      display: block;
    }
  `;
}

/** Home Assistant picks the icon from the entity's domain and state; here every entity gets one. */
class HaStateIcon extends LitElement {
  render() {
    return html`<ha-svg-icon .path=${mdiCheckboxBlankCircleOutline}></ha-svg-icon>`;
  }

  static styles = css`
    :host {
      display: inline-flex;
    }
  `;
}

const elements: [tag: string, element: CustomElementConstructor][] = [
  ["ha-card", HaCard],
  ["ha-svg-icon", HaSvgIcon],
  ["ha-state-icon", HaStateIcon],
];

/** `ha-card`, `ha-svg-icon` and a stand-in `ha-state-icon`; other `ha-*` tags stay unknown. */
export const defineHaElements = (): void => {
  for (const [tag, element] of elements) {
    if (!customElements.get(tag)) {
      customElements.define(tag, element);
    }
  }
};

/** Inline style of a dashboard: Home Assistant's default theme and the text styles it passes down. */
export const haDashboardStyle = (scheme: "light" | "dark" = "light"): string =>
  `${haThemeLight}${scheme === "dark" ? haThemeDark : ""}
  font-family: var(--ha-font-family-body);
  font-size: var(--ha-font-size-m);
  line-height: var(--ha-line-height-normal);
  font-weight: var(--ha-font-weight-normal);
  -webkit-font-smoothing: var(--ha-font-smoothing);
  color: var(--primary-text-color);
  background: var(--primary-background-color);`;
