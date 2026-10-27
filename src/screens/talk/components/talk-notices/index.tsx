import { useAtomValue } from '@effect/atom-react';
import { TriangleAlert } from 'lucide-react';
import { practiceErrorAtom } from '@/core/practice-session';
import { voiceErrorAtom } from '@/core/practice-turn';
import { Notice } from '@/shared/ui/notice';

function Problem({ message }: { message: string }) {
  return (
    <Notice
      className="rounded-control border-warn-line flex items-center gap-3 border"
      role="alert"
      tone="warn"
    >
      <TriangleAlert aria-hidden="true" className="size-4.5 shrink-0" />
      <span>{message}</span>
    </Notice>
  );
}

export function TalkNotices() {
  const practiceError = useAtomValue(practiceErrorAtom);
  const voiceError = useAtomValue(voiceErrorAtom);
  return (
    <>
      {practiceError && <Problem message={practiceError} />}
      {voiceError && <Problem message={voiceError} />}
    </>
  );
}
