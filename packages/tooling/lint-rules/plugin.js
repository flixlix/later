import { definePlugin } from "vite-plus/lint/plugins";
import cognitiveComplexity from "./rules/cognitive-complexity.js";
import hacsLinkCategory from "./rules/hacs-link-category.js";
import noCamelcaseEventBinding from "./rules/no-camelcase-event-binding.js";
import noInstanceofCustomEvent from "./rules/no-instanceof-custom-event.js";
import noMwcElements from "./rules/no-mwc-elements.js";
import noNativeDateInput from "./rules/no-native-date-input.js";
import noUnsupportedRuntimeApis from "./rules/no-unsupported-runtime-apis.js";

export default definePlugin({
  meta: { name: "later" },
  rules: {
    "cognitive-complexity": cognitiveComplexity,
    "hacs-link-category": hacsLinkCategory,
    "no-camelcase-event-binding": noCamelcaseEventBinding,
    "no-instanceof-custom-event": noInstanceofCustomEvent,
    "no-mwc-elements": noMwcElements,
    "no-native-date-input": noNativeDateInput,
    "no-unsupported-runtime-apis": noUnsupportedRuntimeApis,
  },
});
