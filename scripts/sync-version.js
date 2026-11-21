// later-card carries the release version (changesets bump it); the integration ships the same one.
// `node scripts/sync-version.js` copies it into the manifest; `--check` fails when they differ.
import { readFileSync, writeFileSync } from "node:fs";

const MANIFEST = "custom_components/later/manifest.json";
const { version } = JSON.parse(readFileSync("packages/later-card/package.json", "utf8"));
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

if (manifest.version === version) {
  process.exit(0);
}
if (process.argv.includes("--check")) {
  console.error(
    `${MANIFEST} is at ${manifest.version}, later-card at ${version}. Run \`node scripts/sync-version.js\`.`
  );
  process.exit(1);
}
writeFileSync(MANIFEST, `${JSON.stringify({ ...manifest, version }, null, 2)}\n`);
