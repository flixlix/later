import { type ReactNode } from "react";

export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="prose prose-slate max-w-none prose-headings:font-medium prose-a:text-sky-700">
      <h1>{title}</h1>
      {children}
    </article>
  );
}
