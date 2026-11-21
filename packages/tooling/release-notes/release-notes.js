import { CATEGORIES, categoryOfLabel, categoryOfType } from "./categories.js";

const LABELLED = /^\*\*([^*]+):\*\* /;

/**
 * The body of a GitHub release: this version's CHANGELOG entries grouped by category, then a
 * link comparing it with the previous release.
 */
export function releaseNotes({ changelog, version, repo }) {
  const sections = changelogSections(changelog);
  const index = sections.findIndex((section) => section.version === version);
  const entries = index === -1 ? [] : sectionEntries(sections[index].lines);
  const previous = index === -1 ? undefined : sections[index + 1]?.version;

  const groups = CATEGORIES.map((category) => ({
    heading: category.heading,
    entries: entries.filter((entry) => entry.category === category),
  })).filter((group) => group.entries.length > 0);

  const body =
    groups.length > 0
      ? groups
          .map((group) => `## ${group.heading}\n\n${group.entries.map((e) => e.text).join("\n")}`)
          .join("\n\n")
      : `Release v${version}`;
  const compare = previous
    ? `\n\n**Full Changelog**: https://github.com/${repo}/compare/v${previous}...v${version}`
    : "";
  return `${body}${compare}\n`;
}

function changelogSections(changelog) {
  const sections = [];
  for (const line of changelog.split("\n")) {
    const heading = /^## (\S+)\s*$/.exec(line);
    if (heading) {
      sections.push({ version: heading[1], lines: [] });
    } else if (sections.length > 0) {
      sections[sections.length - 1].lines.push(line);
    }
  }
  return sections;
}

function sectionEntries(lines) {
  const entries = [];
  let current;
  for (const line of lines) {
    if (line.startsWith("### ")) {
      current = undefined;
    } else if (line.startsWith("- ")) {
      current = [line.slice(2)];
      entries.push(current);
    } else if (current) {
      current.push(line);
    }
  }
  return entries.map(toReleaseEntry);
}

function toReleaseEntry(lines) {
  const [first, ...rest] = lines.join("\n").trimEnd().split("\n");
  const labelled = LABELLED.exec(first);
  const labelledCategory = labelled ? categoryOfLabel(labelled[1]) : undefined;
  const category = labelledCategory ?? categoryOfType("other");
  const firstLine = labelled && labelledCategory ? first.slice(labelled[0].length) : first;
  const continuation = rest.length > 0 ? `\n${rest.join("\n")}` : "";
  return { category, text: `- ${firstLine}${continuation}` };
}
