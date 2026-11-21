import { HeadContent, Link, Scripts, createRootRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import appCss from "../styles.css?url";

const NAV = [
  { to: "/", label: "Later" },
  { to: "/installation", label: "Installation" },
  { to: "/configuration", label: "Configuration" },
  { to: "/examples", label: "Examples" },
] as const;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Later: one-off scheduled actions for Home Assistant" },
      {
        name: "description",
        content:
          "Run a Home Assistant action once, at a time or in a few minutes. The schedule deletes itself after it runs.",
      },
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
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-slate-50 font-sans text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-slate-600 hover:text-slate-900"
                activeProps={{ className: "font-medium text-slate-900" }}
                activeOptions={{ exact: true }}
              >
                {item.label}
              </Link>
            ))}
            <a
              className="ml-auto text-slate-600 hover:text-slate-900"
              href="https://github.com/flixlix/later"
            >
              GitHub
            </a>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
        <Scripts />
      </body>
    </html>
  );
}
