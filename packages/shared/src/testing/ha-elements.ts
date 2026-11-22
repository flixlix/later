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

/** `ha-button`: Home Assistant's webawesome button, with the looks of its `appearance`s. */
class HaButton extends LitElement {
  @property({ reflect: true }) appearance: "accent" | "filled" | "plain" = "accent";
  @property({ type: Boolean }) loading = false;

  render() {
    return html`<button type="button" ?disabled=${this.loading}><slot></slot></button>`;
  }

  static styles = css`
    :host {
      display: inline-flex;
    }
    button {
      font: inherit;
      font-size: var(--ha-font-size-m, 14px);
      font-weight: var(--ha-font-weight-medium, 500);
      height: 40px;
      padding: 0 16px;
      border: none;
      border-radius: var(--ha-border-radius-pill, 9999px);
      cursor: pointer;
      background: var(--ha-color-fill-primary-loud-resting);
      color: var(--ha-color-on-primary-loud);
      transition: background-color 150ms ease;
    }
    button:hover {
      background: var(--ha-color-fill-primary-loud-hover);
    }
    button:active {
      background: var(--ha-color-fill-primary-loud-active);
    }
    button:focus-visible {
      outline: 2px solid var(--ha-color-focus, var(--primary-color));
      outline-offset: 2px;
    }
    button:disabled {
      cursor: progress;
      opacity: 0.6;
    }
    :host([appearance="filled"]) button {
      background: var(--ha-color-fill-primary-normal-resting);
      color: var(--ha-color-on-primary-normal);
    }
    :host([appearance="filled"]) button:hover {
      background: var(--ha-color-fill-primary-normal-hover);
    }
    :host([appearance="filled"]) button:active {
      background: var(--ha-color-fill-primary-normal-active);
    }
    :host([appearance="plain"]) button {
      background: none;
      color: var(--ha-color-on-primary-normal);
    }
    :host([appearance="plain"]) button:hover {
      background: var(--ha-color-fill-primary-quiet-hover);
    }
    :host([appearance="plain"]) button:active {
      background: var(--ha-color-fill-primary-quiet-active);
    }
  `;
}

/** `ha-filter-chip`: a Material filter chip that toggles `selected` itself when clicked. */
class HaFilterChip extends LitElement {
  @property() label = "";
  @property({ type: Boolean, reflect: true }) selected = false;

  render() {
    return html`<button type="button" aria-pressed=${this.selected} @click=${this._toggle}>
      ${this.label}
    </button>`;
  }

  private _toggle = () => {
    this.selected = !this.selected;
  };

  static styles = css`
    button {
      font: inherit;
      font-size: var(--ha-font-size-m, 14px);
      font-weight: var(--ha-font-weight-medium, 500);
      height: 32px;
      padding: 0 16px;
      border: 1px solid var(--outline-color, #ccc);
      border-radius: 8px;
      background: none;
      color: var(--primary-text-color);
      cursor: pointer;
    }
    button:hover {
      background: var(--ha-color-fill-neutral-quiet-hover, rgba(0, 0, 0, 0.04));
    }
    :host([selected]) button {
      border-color: transparent;
      background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.15);
    }
  `;
}

class HaChipSet extends LitElement {
  render() {
    return html`<slot></slot>`;
  }

  static styles = css`
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `;
}

const elements: [tag: string, element: CustomElementConstructor][] = [
  ["ha-card", HaCard],
  ["ha-svg-icon", HaSvgIcon],
  ["ha-state-icon", HaStateIcon],
  ["ha-button", HaButton],
  ["ha-filter-chip", HaFilterChip],
  ["ha-chip-set", HaChipSet],
];

/** `ha-card`, `ha-svg-icon` and stand-ins for `ha-state-icon`, `ha-button` and the chips; other `ha-*` tags stay unknown. */
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
