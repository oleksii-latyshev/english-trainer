import { Button } from '@heroui/react';
import { Bookmark, Clock, Mic, TriangleAlert } from 'lucide-react';
import { Eva } from '@/components/eva/Eva';
import type { SessionMode } from '@/lib/types';
import {
  PRIMARY_ACTION_LABEL,
  primaryAction,
  resumeDetail,
  reviewHint,
  reviewTitle,
} from './lib/talkStartState';
import { useDuePhraseCount } from './useDuePhraseCount';
import './talkStart.css';

type Props = {
  isBusy: boolean;
  error: string;
  isRestoring: boolean;
  /** Present while a session is open. */
  openSession?: { mode: SessionMode; turnCount: number; targetTurns: number };
  onStartOrResume: () => void;
  onOpenMemory: () => void;
};

export function TalkStart({
  isBusy,
  error,
  isRestoring,
  openSession,
  onStartOrResume,
  onOpenMemory,
}: Props) {
  const due = useDuePhraseCount();
  const action = primaryAction({
    isRestoring,
    isBusy,
    hasActiveSession: openSession !== undefined,
  });

  return (
    <div className="talk-start">
      <header className="talk-start-greeting">
        <Eva decorative mood="happy" size={96} />
        <div className="talk-start-greeting-copy">
          <h1>Ready to talk?</h1>
          <p>
            Eva will ask short questions. Answer out loud — notes on your phrasing appear as you go.
          </p>
        </div>
      </header>

      {openSession && (
        <section aria-label="Open conversation" className="talk-start-card">
          <Clock aria-hidden="true" className="talk-start-card-icon talk-start-icon-me" size={20} />
          <div className="talk-start-card-copy">
            <div className="talk-start-card-title">Continue your conversation</div>
            <div className="talk-start-card-hint">{resumeDetail(openSession)}</div>
          </div>
          <Button
            className="talk-start-card-action"
            isDisabled={isRestoring}
            onPress={onStartOrResume}
            variant="secondary"
          >
            Continue
          </Button>
        </section>
      )}

      {due.tag === 'ready' && (
        <section aria-label="Phrases to review" className="talk-start-card">
          <Bookmark
            aria-hidden="true"
            className="talk-start-card-icon talk-start-icon-accent"
            size={20}
          />
          <div className="talk-start-card-copy">
            <div className="talk-start-card-title">{reviewTitle(due.dueCount)}</div>
            <div className="talk-start-card-hint">{reviewHint(due.dueCount)}</div>
          </div>
          {due.dueCount > 0 && (
            <Button className="talk-start-card-action" onPress={onOpenMemory} variant="secondary">
              Review now
            </Button>
          )}
        </section>
      )}

      {error && (
        <div className="talk-start-notice" role="alert">
          <TriangleAlert aria-hidden="true" size={18} />
          <span>{error}</span>
          <Button isDisabled={isBusy} onPress={onStartOrResume} size="sm" variant="secondary">
            Try again
          </Button>
        </div>
      )}

      {/* With a session open the Continue card is the one next step; a second resume button would duplicate it. */}
      {!openSession && (
        <div className="talk-start-primary">
          <Button
            className="talk-start-cta"
            isDisabled={isBusy || isRestoring}
            onPress={onStartOrResume}
            variant="primary"
          >
            <Mic aria-hidden="true" size={18} strokeWidth={2.2} />
            {PRIMARY_ACTION_LABEL[action]}
          </Button>
        </div>
      )}
    </div>
  );
}
