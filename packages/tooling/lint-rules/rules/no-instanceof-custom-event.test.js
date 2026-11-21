import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import rule from "./no-instanceof-custom-event.js";

RuleTester.describe = describe;
RuleTester.it = it;

new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } }).run(
  "no-instanceof-custom-event",
  rule,
  {
    valid: [
      'const ok = "detail" in event && isRecord(event.detail);',
      "const ok = event instanceof KeyboardEvent;",
      "const event = new CustomEvent('closed', { bubbles: true });",
    ],
    invalid: [
      { code: "const ok = event instanceof CustomEvent && event.detail;", errors: 1 },
      { code: "if (!(event instanceof CustomEvent)) { return; }", errors: 1 },
    ],
  }
);
