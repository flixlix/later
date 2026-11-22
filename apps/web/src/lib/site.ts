export const SITE_URL = "https://later.flixlix.com";
export const SITE_NAME = "Later";
export const REPO_URL = "https://github.com/flixlix/later";

/** My Home Assistant links: open Later in HACS, and start adding the integration. */
export const HACS_LINK =
  "https://my.home-assistant.io/redirect/hacs_repository/?owner=flixlix&repository=later&category=integration";
export const ADD_INTEGRATION_LINK =
  "https://my.home-assistant.io/redirect/config_flow_start/?domain=later";

export const newIssueUrl = (template: "bug-report.yaml" | "feature-request.yaml") =>
  `${REPO_URL}/issues/new?template=${template}`;

export type Heading = { id: string; label: string; depth?: 1 | 2 };

export type DocsPage = {
  path: "/" | "/installation" | "/configuration" | "/examples";
  /** Sidebar, breadcrumb and previous/next label. */
  label: string;
  title: string;
  description: string;
  /** "On this page", and the sections search finds. */
  headings: Heading[];
};

export const PAGE = {
  overview: {
    path: "/",
    label: "Overview",
    title: "Later: one-off scheduled actions for Home Assistant",
    description:
      "Run a Home Assistant action once, at a time or in a few minutes. The schedule deletes itself after it runs.",
    headings: [
      { id: "try-it", label: "Try it" },
      { id: "how-it-behaves", label: "How it behaves" },
      { id: "faq", label: "Common questions" },
    ],
  },
  installation: {
    path: "/installation",
    label: "Installation",
    title: "Install Later in Home Assistant",
    description:
      "Install the Later integration from HACS or by hand. The card ships inside it: no dashboard resource to add.",
    headings: [
      { id: "hacs", label: "HACS (recommended)" },
      { id: "manual", label: "Manual installation" },
      { id: "verify", label: "Verify the install" },
      { id: "how-the-card-loads", label: "How the card is loaded" },
    ],
  },
  configuration: {
    path: "/configuration",
    label: "Configuration",
    title: "Later card options and services",
    description:
      "Every option of the Later card, the later.add, later.cancel and later.run_now services, the schedule they return and the websocket API.",
    headings: [
      { id: "card", label: "Card" },
      { id: "using-the-card", label: "Using the card", depth: 2 },
      { id: "languages", label: "Languages", depth: 2 },
      { id: "services", label: "Services" },
      { id: "later-add", label: "later.add", depth: 2 },
      { id: "later-cancel", label: "later.cancel", depth: 2 },
      { id: "later-run-now", label: "later.run_now", depth: 2 },
      { id: "schedule", label: "A schedule" },
      { id: "events", label: "Events and logbook" },
      { id: "websocket", label: "Websocket API" },
    ],
  },
  examples: {
    path: "/examples",
    label: "Examples",
    title: "Later examples: cards, services and automations",
    description:
      "Copy-pastable Later configs: a card per device, a light off in 30 minutes, a script on a date, and cancelling a schedule from an automation.",
    headings: [
      { id: "cards", label: "Cards" },
      { id: "heater-off-tonight", label: "Heater off tonight" },
      { id: "light-off-in-30-minutes", label: "Light off in 30 minutes" },
      { id: "script-on-a-date", label: "A script on a date" },
      { id: "off-again-after-on", label: "Off again after an automation" },
      { id: "cancel-from-automation", label: "Cancel from an automation" },
    ],
  },
} satisfies Record<string, DocsPage>;

/** Every page, in reading order: the sidebar, previous/next, search, the sitemap and llms.txt. */
export const PAGES: DocsPage[] = Object.values(PAGE);

export const findPage = (path: string) =>
  PAGES.find((page) => page.path === (path.length > 1 ? path.replace(/\/+$/, "") : path));

export type Option = {
  name: string;
  type: string;
  default?: string;
  required?: boolean;
  /** `backticks` mark code. */
  description: string;
};

export const CARD_OPTIONS: Option[] = [
  { name: "type", type: "string", required: true, description: "`custom:later-card`" },
  { name: "title", type: "string", default: "Later", description: "Card title." },
  {
    name: "entity",
    type: "string",
    description:
      "Entity preselected when you schedule something, e.g. `switch.heater`. You can still pick another.",
  },
];

export const ADD_FIELDS: Option[] = [
  {
    name: "entity_id",
    type: "string",
    description: "Target entity. Required with `action`.",
  },
  {
    name: "action",
    type: "string",
    description:
      "`turn_on`, `turn_off` or `toggle` for the entity's domain. Either this or `service`.",
  },
  {
    name: "service",
    type: "string",
    description: "Any service as `domain.service`. Either this or `action`.",
  },
  {
    name: "data",
    type: "object",
    description: "Service data. The `entity_id` is added unless `data` has its own.",
  },
  {
    name: "at",
    type: "string",
    description:
      "`20:00` (today, or tomorrow once it has passed) or a date and time such as `2026-12-24 18:00`, in the Home Assistant time zone. Either this or `in`.",
  },
  {
    name: "in",
    type: "number",
    description: "Minutes from now, a whole number above 0. Either this or `at`.",
  },
  {
    name: "name",
    type: "string",
    default: "Heater: turn off at 20:00",
    description: "Shown in the card and the logbook.",
  },
];

export const ID_FIELD: Option[] = [
  {
    name: "id",
    type: "string",
    required: true,
    description: "The schedule's id, from `later.add`.",
  },
];
