import { type HomeAssistant } from "custom-card-helpers";
import { expect, test } from "vite-plus/test";
import { LaterCardEditor } from "./ui-editor";

const edit = async (value: Record<string, unknown>) => {
  const editor = new LaterCardEditor();
  editor.hass = {} as HomeAssistant;
  editor.setConfig({ type: "custom:later-card", title: "Old" });
  document.body.append(editor);
  await editor.updateComplete;
  const changes: unknown[] = [];
  editor.addEventListener("config-changed", (event) => {
    changes.push((event as CustomEvent<{ config: unknown }>).detail.config);
  });
  editor.shadowRoot
    ?.querySelector("ha-form")
    ?.dispatchEvent(new CustomEvent("value-changed", { detail: { value } }));
  editor.remove();
  return changes;
};

test("writes the title and default entity the form reports", async () => {
  expect(
    await edit({ type: "custom:later-card", title: "Heating", entity: "switch.heater" })
  ).toEqual([{ type: "custom:later-card", title: "Heating", entity: "switch.heater" }]);
});

test("drops cleared fields instead of writing empty strings", async () => {
  expect(await edit({ type: "custom:later-card", title: "", entity: "" })).toEqual([
    { type: "custom:later-card" },
  ]);
});
