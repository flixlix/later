import { createFileRoute } from "@tanstack/react-router";
import { Code } from "../components/code";
import { Page } from "../components/page";

export const Route = createFileRoute("/installation")({
  head: () => ({ meta: [{ title: "Installation | Later" }] }),
  component: Installation,
});

const HACS_LINK =
  "https://my.home-assistant.io/redirect/hacs_repository/?owner=flixlix&repository=later&category=integration";
const ADD_LINK = "https://my.home-assistant.io/redirect/config_flow_start/?domain=later";

function Installation() {
  return (
    <Page title="Installation">
      <p>
        Later needs Home Assistant 2025.12 or newer. The card ships inside the integration: there is
        no separate card download and no dashboard resource to add.
      </p>
      <h2>HACS</h2>
      <ol>
        <li>
          <a href={HACS_LINK}>Open Later in HACS</a>, or in HACS add{" "}
          <code>https://github.com/flixlix/later</code> as a custom repository of type{" "}
          <b>Integration</b>.
        </li>
        <li>Download Later and restart Home Assistant.</li>
        <li>
          <a href={ADD_LINK}>Add the integration</a>: Settings → Devices & services → Add
          integration → Later. It has no options.
        </li>
        <li>
          Edit a dashboard, add a card and pick <b>Later</b>, or add{" "}
          <code>type: custom:later-card</code> in YAML. Reload the browser once if the card is not
          listed yet.
        </li>
      </ol>
      <h2>Manual</h2>
      <ol>
        <li>
          Download the latest release from{" "}
          <a href="https://github.com/flixlix/later/releases">GitHub releases</a>.
        </li>
        <li>
          Copy <code>custom_components/later</code>, including <code>www/later-card.js</code>, into
          the <code>custom_components</code> folder of your Home Assistant config.
        </li>
        <li>Restart Home Assistant and add the integration as above.</li>
      </ol>
      <Code label="Resulting layout">{`
config/
  custom_components/
    later/
      __init__.py
      manifest.json
      www/later-card.js
      ...
`}</Code>
      <h2>How the card is loaded</h2>
      <p>
        On startup the integration serves <code>www/later-card.js</code> at{" "}
        <code>/later/later-card.js</code> and registers it as an extra frontend module, so every
        dashboard can use <code>custom:later-card</code>. Remove any dashboard resource you added
        for it by hand. If the card shows “The Later integration is not installed”, the integration
        is missing; “installed but not set up” means the config entry was not added.
      </p>
    </Page>
  );
}
