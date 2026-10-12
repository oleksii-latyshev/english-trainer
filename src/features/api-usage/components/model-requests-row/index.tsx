type Props = { model: string; requests: number; share: number };

export function ModelRequestsRow({ model, requests, share }: Props) {
  return (
    <div className="flex items-center gap-2.5 border-line border-t px-5 py-2 text-caption">
      <span className="w-44 flex-none truncate font-mono">{model}</span>
      <span aria-hidden="true" className="block h-2 flex-1 overflow-hidden rounded-sm bg-surface-2">
        <span className="block h-full bg-accent" style={{ width: `${share}%` }} />
      </span>
      <span className="font-mono">{requests}</span>
    </div>
  );
}
