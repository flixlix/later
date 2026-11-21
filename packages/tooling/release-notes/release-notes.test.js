import { expect, it } from "vite-plus/test";
import { releaseNotes } from "./release-notes.js";

const changelog = `# later-card

## 0.1.1

### Patch Changes

- **Fix:** Cancelled schedules leave the list at once. ([#4](https://github.com/flixlix/later/pull/4))
- **New:** Chips for 15, 30 and 60 minutes.

## 0.1.0

### Patch Changes

- **New:** First release.
`;

it("groups this version's entries by category and links the previous release", () => {
  expect(releaseNotes({ changelog, version: "0.1.1", repo: "flixlix/later" })).toBe(
    `## ✨ New

- Chips for 15, 30 and 60 minutes.

## 🐛 Fixes

- Cancelled schedules leave the list at once. ([#4](https://github.com/flixlix/later/pull/4))

**Full Changelog**: https://github.com/flixlix/later/compare/v0.1.0...v0.1.1
`
  );
});

it("has no compare link for the first release", () => {
  expect(releaseNotes({ changelog, version: "0.1.0", repo: "flixlix/later" })).toBe(
    "## ✨ New\n\n- First release.\n"
  );
});
