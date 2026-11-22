import { type DocsPage, SITE_NAME, SITE_URL } from "./site";

/** Title, description, social cards and canonical link of a page. */
export function pageHead(page: DocsPage) {
  const url = `${SITE_URL}${page.path === "/" ? "" : page.path}`;
  return {
    meta: [
      { title: page.path === "/" ? page.title : `${page.title} | ${SITE_NAME}` },
      { name: "description", content: page.description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:url", content: url },
      { property: "og:title", content: page.title },
      { property: "og:description", content: page.description },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
