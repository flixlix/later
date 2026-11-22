import { type MouseEvent, type ReactNode, useEffect, useState } from "react";

import { type DocsPage as Page, type Heading } from "../lib/site";
import { NextPageNav, SupportLinks, cx } from "./docs";

/** A page's content, its "On this page" beside it on wide screens, and previous/next under it. */
export function DocsPage({
  page,
  toc = true,
  children,
}: {
  page: Page;
  toc?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cx("grid gap-10", toc && "xl:grid-cols-[minmax(0,1fr)_13rem]")}>
      <article className="min-w-0">
        {children}
        <SupportLinks />
        <NextPageNav path={page.path} />
      </article>
      {toc ? (
        <aside className="hidden xl:block">
          <PageToc headings={page.headings} className="sticky top-20" />
        </aside>
      ) : null}
    </div>
  );
}

function useActiveHeading(headings: Heading[]) {
  const [active, setActive] = useState(headings[0]?.id);
  useEffect(() => {
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.add(entry.target.id);
          } else {
            visible.delete(entry.target.id);
          }
        }
        const top = headings.find((heading) => visible.has(heading.id));
        if (top) {
          setActive(top.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px" }
    );
    for (const heading of headings) {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    }
    return () => observer.disconnect();
  }, [headings]);
  return [active, setActive] as const;
}

function PageToc({ headings, className }: { headings: Heading[]; className?: string }) {
  const [active, setActive] = useActiveHeading(headings);

  function jumpTo(event: MouseEvent<HTMLAnchorElement>, id: string) {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    event.preventDefault();
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    window.history.replaceState(null, "", `#${id}`);
    setActive(id);
  }

  return (
    <nav aria-label="On this page" className={cx("text-sm", className)}>
      <div className="mb-3 font-medium">On this page</div>
      <ul className="border-l">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              onClick={(event) => jumpTo(event, heading.id)}
              aria-current={active === heading.id ? "location" : undefined}
              className={cx(
                "-ml-px block border-l py-1 pr-2 transition-colors",
                heading.depth === 2 ? "pl-6" : "pl-3",
                active === heading.id
                  ? "border-solar text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent"
              )}
            >
              {heading.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
