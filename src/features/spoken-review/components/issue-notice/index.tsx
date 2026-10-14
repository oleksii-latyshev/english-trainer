import { useAtomValue } from '@effect/atom-react';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { REVIEW_FIX_LABEL } from '../../helpers/review-issue';
import { useReviewCommands } from '../../model/use-review-commands';
import { issueAtom } from '../../model/view-atoms';

type Props = {
  onOpenSettings: () => void;
};

export function IssueNotice({ onOpenSettings }: Props) {
  const issue = useAtomValue(issueAtom);
  const commands = useReviewCommands();
  if (issue === null) return null;

  return (
    <Notice
      className="flex items-center justify-between gap-3 rounded-control border"
      role="alert"
      tone="warn"
    >
      <span>{issue.message}</span>
      <Button onClick={() => commands.fix(issue.fix, onOpenSettings)} size="sm" tone="secondary">
        {REVIEW_FIX_LABEL[issue.fix]}
      </Button>
    </Notice>
  );
}
