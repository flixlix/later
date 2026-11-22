import { createFileRoute } from "@tanstack/react-router";

import { ADD_FIELDS, CARD_OPTIONS, ID_FIELD, type Option, PAGES, SITE_URL } from "../lib/site";

const optionLine = (option: Option) =>
  `- \`${option.name}\` (${option.type}${option.required ? ", required" : ""}${option.default ? `, default \`${option.default}\`` : ""}): ${option.description}`;

/** What an assistant needs to write a Later card or service call: the pages and every option. */
const llms = () => `# Later

> A Home Assistant integration and dashboard card for one-off scheduled actions: run an action once, at a clock time or in a number of minutes, then the schedule deletes itself. No repeats, no entity per schedule.

Use only the options and fields listed here. Replace entity IDs with the user's own.

## Pages

${PAGES.map((page) => `- [${page.label}](${SITE_URL}${page.path === "/" ? "" : page.path}): ${page.description}`).join("\n")}

## Card options (\`type: custom:later-card\`)

${CARD_OPTIONS.map(optionLine).join("\n")}

## later.add fields

${ADD_FIELDS.map(optionLine).join("\n")}

Returns the schedule: \`id\`, \`name\`, \`run_at\` (UTC), \`created_at\`, \`service\`, \`data\`, \`entity_id\`, \`source\`.

## later.cancel and later.run_now fields

${ID_FIELD.map(optionLine).join("\n")}

\`later.cancel\` deletes a pending schedule without running it; \`later.run_now\` runs it now, then deletes it.
`;

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(llms(), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
          },
        }),
    },
  },
});
