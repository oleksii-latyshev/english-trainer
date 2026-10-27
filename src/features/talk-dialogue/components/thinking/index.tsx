export function Thinking() {
  return (
    <div className="flex items-center gap-3">
      <div className="border-line bg-surface-2 rounded-2xl rounded-tl-md border px-4.5 py-3.5">
        <span aria-label="Eva is thinking" className="flex gap-1" role="status">
          <i className="bg-muted size-1.5 animate-pulse rounded-full motion-reduce:animate-none" />
          <i className="bg-muted size-1.5 animate-pulse rounded-full motion-reduce:animate-none" />
          <i className="bg-muted size-1.5 animate-pulse rounded-full motion-reduce:animate-none" />
        </span>
      </div>
    </div>
  );
}
