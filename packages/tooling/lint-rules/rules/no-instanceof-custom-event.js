import { defineRule } from "vite-plus/lint/plugins";

const noInstanceofCustomEvent = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `instanceof CustomEvent`: Home Assistant's `fireEvent` dispatches a plain `Event` with `detail` assigned, so the check drops every value its elements report.",
    },
    messages: {
      noInstanceofCustomEvent:
        'Home Assistant elements (`ha-form`, pickers, dialogs) fire a plain `Event` with `detail` assigned, so `instanceof CustomEvent` is false for them. Check `"detail" in event` instead.',
    },
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (
          node.operator === "instanceof" &&
          node.right.type === "Identifier" &&
          node.right.name === "CustomEvent"
        ) {
          context.report({ node, messageId: "noInstanceofCustomEvent" });
        }
      },
    };
  },
});

export default noInstanceofCustomEvent;
