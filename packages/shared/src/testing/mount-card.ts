import { type HomeAssistant } from "custom-card-helpers";
import { defineHaElements, haDashboardStyle } from "./ha-elements";

type CardElement = HTMLElement & {
  hass?: HomeAssistant;
  setConfig(config: object): void;
  updateComplete: Promise<boolean>;
};

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Lets the card and its child elements finish the updates their first render triggers. */
const settle = async (root: HTMLElement, frames = 4): Promise<void> => {
  if (frames === 0) {
    return;
  }
  await nextFrame();
  const elements = [root, ...(root.shadowRoot?.querySelectorAll("*") ?? [])];
  await Promise.all(
    elements.map((element) =>
      Promise.resolve("updateComplete" in element ? element.updateComplete : undefined)
    )
  );
  return settle(root, frames - 1);
};

export type MountedCard = {
  card: CardElement;
  root: ShadowRoot;
  /** Whitespace-collapsed text of the first element matching the selector. */
  text: (selector: string) => string | undefined;
  settle: () => Promise<void>;
};

let mounted: HTMLElement | undefined;

/** Mounts a card on a themed dashboard background, replacing the previously mounted one. */
export const mountCard = async (
  Card: new () => CardElement,
  config: object,
  hass: HomeAssistant,
  { width = 400, scheme = "light" }: { width?: number; scheme?: "light" | "dark" } = {}
): Promise<MountedCard> => {
  defineHaElements();
  mounted?.remove();
  const container = document.createElement("div");
  container.style.cssText = `${haDashboardStyle(scheme)} width: ${width}px; padding: 8px;`;
  const card = new Card();
  card.setConfig(config);
  card.hass = hass;
  container.append(card);
  document.body.append(container);
  mounted = container;
  await settle(card);
  const root = card.shadowRoot;
  if (!root) {
    throw new Error(`mountCard: <${card.localName}> rendered no shadow root`);
  }
  return {
    card,
    root,
    text: (selector) => root.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim(),
    settle: () => settle(card),
  };
};
