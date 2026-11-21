/**
 * What `ha-form` dispatches when the user changes a field. Home Assistant's `fireEvent` sends a
 * plain `Event` with `detail` assigned to it, not a `CustomEvent`.
 */
export const haValueChanged = (value: unknown): Event =>
  Object.assign(new Event("value-changed", { bubbles: true, composed: true }), {
    detail: { value },
  });
