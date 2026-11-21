import { expect, test } from "vite-plus/test";
import { LaterCard } from "./later-card";

test("registers itself as <later-card>", () => {
  expect(customElements.get("later-card")).toBe(LaterCard);
});
