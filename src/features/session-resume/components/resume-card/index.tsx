import { Clock } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { resumeDetail } from '../../helpers/resume-detail';
import type { OpenSession } from '../../types';

type Props = {
  session: OpenSession;
  isDisabled: boolean;
  onContinue: () => void;
};

export function ResumeCard({ session, isDisabled, onContinue }: Props) {
  return (
    <GlassPanel
      aria-label="Open conversation"
      className="max-rail:flex-wrap flex items-center gap-4 p-5"
    >
      <Clock aria-hidden="true" className="text-me size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-body font-bold">Continue: {session.topicLabel}</div>
        <div className="text-caption text-muted">{resumeDetail(session)}</div>
      </div>
      <Button disabled={isDisabled} onClick={onContinue} tone="secondary">
        Continue
      </Button>
    </GlassPanel>
  );
}
