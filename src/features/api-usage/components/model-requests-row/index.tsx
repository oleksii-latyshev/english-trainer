type Props = { model: string; requests: number; share: number };

export function ModelRequestsRow({ model, requests, share }: Props) {
  return (
    <div className="border-line text-caption flex items-center gap-2.5 border-t px-5 py-2">
      <span className="w-44 flex-none truncate font-mono">{model}</span>
      <span aria-hidden="true" className="bg-surface-2 block h-2 flex-1 overflow-hidden rounded-sm">
        <span className="bg-accent block h-full" style={{ width: `${share}%` }} />
      </span>
      <span className="font-mono">{requests}</span>
    </div>
  );
}
