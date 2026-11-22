// later-card carries the release version (changesets bump it); the integration ships the same one.
// `node scripts/sync-version.js` copies it into the manifest; `--check` fails when they differ.
import { readFileSync, writeFileSync } from "node:fs";

const MANIFEST = "custom_components/later/manifest.json";
const { version } = JSON.parse(readFileSync("packages/later-card/package.json", "utf8"));
const text = readFileSync(MANIFEST, "utf8");
const manifest = JSON.parse(text);

if (manifest.version === version) {
  process.exit(0);
}
if (process.argv.includes("--check")) {
  console.error(
    `${MANIFEST} is at ${manifest.version}, later-card at ${version}. Run \`node scripts/sync-version.js\`.`
  );
  process.exit(1);
}
// Only the version line changes, so the file keeps the formatter's layout.
writeFileSync(
  MANIFEST,
  text.replace(`"version": "${manifest.version}"`, `"version": "${version}"`)
);
