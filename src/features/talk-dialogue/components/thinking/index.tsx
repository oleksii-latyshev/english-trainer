export function Thinking() {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-2xl rounded-tl-md border border-line bg-surface-2 px-4.5 py-3.5">
        <span aria-label="Eva is thinking" className="flex gap-1" role="status">
          <i className="size-1.5 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
          <i className="size-1.5 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
          <i className="size-1.5 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
        </span>
      </div>
    </div>
  );
}
