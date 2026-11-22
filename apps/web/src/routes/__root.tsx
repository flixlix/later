import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { PanelLeft, X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

import { Search } from "../components/search";
import { Sidebar } from "../components/sidebar";
import { BUTTON, GithubIcon, Scrim, cx } from "../components/docs";
import { REPO_URL, findPage } from "../lib/site";
import { THEME_INIT_SCRIPT } from "../lib/theme";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#f97316" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased selection:bg-solar/30">
        <DocsLayout>{children}</DocsLayout>
        <Scripts />
      </body>
    </html>
  );
}

function DocsLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const page = findPage(pathname);
  const drawer = useRef<HTMLDialogElement>(null);
  const closeDrawer = () => drawer.current?.close();

  useEffect(closeDrawer, [pathname]);

  return (
    <div className="flex min-h-svh">
      <aside className="bg-background sticky top-0 hidden h-svh w-64 shrink-0 border-r lg:block">
        <Sidebar />
      </aside>
      <dialog
        ref={drawer}
        aria-label="Navigation"
        className="text-foreground m-0 size-full max-h-none max-w-none bg-transparent p-0 backdrop:bg-transparent lg:hidden"
      >
        <Scrim label="Close navigation" onClose={closeDrawer} />
        <div className="bg-background relative h-full w-72 max-w-[85vw] border-r">
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close navigation"
            className={cx(BUTTON, "hover:bg-accent absolute top-3 right-2 size-8 px-0")}
          >
            <X />
          </button>
          <Sidebar onNavigate={closeDrawer} />
        </div>
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/80 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => drawer.current?.showModal()}
            aria-label="Open navigation"
            className={cx(BUTTON, "hover:bg-accent -ml-1 size-8 px-0 lg:hidden")}
          >
            <PanelLeft />
          </button>
          <nav aria-label="Breadcrumb" className="hidden text-sm sm:block">
            <ol className="text-muted-foreground flex items-center gap-1.5">
              <li>
                <Link to="/" className="hover:text-foreground transition-colors">
                  Docs
                </Link>
              </li>
              {page && page.path !== "/" ? (
                <>
                  <li aria-hidden>/</li>
                  <li aria-current="page" className="text-foreground">
                    {page.label}
                  </li>
                </>
              ) : null}
            </ol>
          </nav>
          <div className="ml-auto flex flex-1 items-center justify-end gap-2 sm:flex-none">
            <Search className="w-full sm:w-72" />
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
              className={cx(BUTTON, "hover:bg-accent h-8 px-2.5")}
            >
              <GithubIcon />
              <span className="hidden md:inline">GitHub</span>
            </a>
          </div>
        </header>
        <main className="flex-1 overflow-x-clip px-4 py-8 md:px-8 lg:px-12">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
        <footer className="border-t px-4 py-6 md:px-8 lg:px-12">
          <div className="text-muted-foreground mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 text-xs">
            <p>Made by Luca, so the heater turns off even when you forget.</p>
            <p className="inline-flex gap-3">
              <a
                href={`${REPO_URL}/blob/main/LICENSE`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground decoration-solar font-medium underline-offset-4 hover:underline"
              >
                MIT License
              </a>
              <a
                href="https://github.com/flixlix"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground decoration-solar font-medium underline-offset-4 hover:underline"
              >
                @flixlix
              </a>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
