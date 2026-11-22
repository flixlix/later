import { createFileRoute } from "@tanstack/react-router";

import { DocsPage } from "../components/docs-page";
import {
  BUTTON_OUTLINE,
  BUTTON_PRIMARY,
  Callout,
  CodeBlock,
  HomeAssistantIcon,
  PageHeader,
  Prose,
  Section,
} from "../components/docs";
import { pageHead } from "../lib/head";
import { ADD_INTEGRATION_LINK, HACS_LINK, PAGE, REPO_URL } from "../lib/site";

const page = PAGE.installation;

export const Route = createFileRoute("/installation")({
  head: () => pageHead(page),
  component: Installation,
});

function Installation() {
  return (
    <DocsPage page={page}>
      <PageHeader
        eyebrow="Get started"
        title="Installation"
        description="Later needs Home Assistant 2025.12 or newer. The card ships inside the integration: there is no separate card download and no dashboard resource to add."
      />

      <div className="mb-10 flex flex-wrap gap-2">
        <a href={HACS_LINK} target="_blank" rel="noopener noreferrer" className={BUTTON_PRIMARY}>
          <HomeAssistantIcon /> Open Later in HACS
        </a>
        <a
          href={ADD_INTEGRATION_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className={BUTTON_OUTLINE}
        >
          <HomeAssistantIcon /> Add the integration
        </a>
      </div>

      <Section id="hacs" title="HACS (recommended)">
        <Callout title="Not in the default catalog yet">
          Later is installed as a custom repository. The <strong>Open Later in HACS</strong> button
          does step 1 for you.
        </Callout>
        <Prose>
          <ol>
            <li>
              In HACS, open the <strong>⋮</strong> menu, choose <strong>Custom repositories</strong>{" "}
              and add <code>{REPO_URL}</code> with type <strong>Integration</strong>.
            </li>
            <li>
              Search for <strong>Later</strong>, select <strong>Download</strong> and restart Home
              Assistant.
            </li>
            <li>
              Go to <strong>Settings → Devices & services → Add integration → Later</strong>, or use
              the <strong>Add the integration</strong> button above. It has no options.
            </li>
          </ol>
        </Prose>
      </Section>

      <Section id="manual" title="Manual installation">
        <Prose>
          <ol>
            <li>
              Download the latest release from <a href={`${REPO_URL}/releases`}>GitHub releases</a>.
            </li>
            <li>
              Copy <code>custom_components/later</code>, including <code>www/later-card.js</code>,
              into the <code>custom_components</code> folder of your Home Assistant config.
            </li>
            <li>Restart Home Assistant and add the integration as above.</li>
          </ol>
        </Prose>
        <CodeBlock
          label="text"
          code={`
config/
  custom_components/
    later/
      __init__.py
      manifest.json
      www/later-card.js
      ...
`}
        />
      </Section>

      <Section id="verify" title="Verify the install">
        <Prose>
          <p>
            Edit a dashboard, select <strong>Add card</strong> and pick <strong>Later</strong>, or
            paste this into the YAML editor. Reload the browser once if the card isn't listed yet.
          </p>
        </Prose>
        <CodeBlock code="type: custom:later-card" />
        <Callout variant="tip" title="Card shows an error?">
          “The Later integration is not installed” means Home Assistant doesn't have the
          integration; “installed but not set up” means it was downloaded but not added under
          Devices & services.
        </Callout>
      </Section>

      <Section id="how-the-card-loads" title="How the card is loaded">
        <Prose>
          <p>
            On startup the integration serves <code>www/later-card.js</code> at{" "}
            <code>/later/later-card.js</code> and registers it as an extra frontend module, so every
            dashboard can use <code>custom:later-card</code>. Remove any dashboard resource you
            added for it by hand.
          </p>
        </Prose>
      </Section>
    </DocsPage>
  );
}
