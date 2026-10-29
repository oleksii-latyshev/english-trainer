import { RunBody, RunHeader } from '@/features/mistake-run';
import type { MistakeRunScreenProps } from './types';

export function MistakeRunScreen({ runId, micBlockedReason, onLeave }: MistakeRunScreenProps) {
  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-6">
      <RunHeader runId={runId} />
      <RunBody micBlockedReason={micBlockedReason} onLeave={onLeave} runId={runId} />
    </div>
  );
}
