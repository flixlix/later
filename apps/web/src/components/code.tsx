/** A block of YAML or shell, as written in Home Assistant or a terminal. */
export function Code({ children, label }: { children: string; label?: string }) {
  return (
    <figure className="not-prose my-4">
      {label ? <figcaption className="mb-1 text-xs text-slate-500">{label}</figcaption> : null}
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm leading-relaxed text-slate-100">
        <code>{children.trim()}</code>
      </pre>
    </figure>
  );
}
