import { Button, Card, Chip } from '@heroui/react';
import { Rabbit } from 'lucide-react';
import { MemorySnapshot } from './MemorySnapshot';
import './dashboard.css';

type Props = {
  busy: boolean;
  error: string;
  hasActiveSession: boolean;
  isRestoring: boolean;
  onStartPractice: () => void;
  onOpenMemory: () => void;
};

function practiceActionLabel(isRestoring: boolean, busy: boolean, hasActiveSession: boolean) {
  if (isRestoring) return 'Restoring your conversation…';
  if (hasActiveSession) return 'Resume conversation';
  if (busy) return 'Starting practice…';
  return 'Start 10–15 Minute Practice';
}

export function DailyPracticeDashboard({
  busy,
  error,
  hasActiveSession,
  isRestoring,
  onStartPractice,
  onOpenMemory,
}: Props) {
  const actionLabel = practiceActionLabel(isRestoring, busy, hasActiveSession);
  const sessionStatus = isRestoring
    ? 'Restoring conversation'
    : hasActiveSession
      ? 'Conversation in progress'
      : busy
        ? 'Starting conversation'
        : 'Ready to start';
  const isLoading = busy || isRestoring;

  return (
    <div className="dashboard-content">
      <section aria-labelledby="dashboard-title">
        <Card className="panel dashboard-hero-card" variant="secondary">
          <Card.Header className="dashboard-hero-header">
            <div>
              <p className="eyebrow">DAILY PRACTICE</p>
              <h1 id="dashboard-title">Make today a speaking day.</h1>
            </div>
            <Chip
              className="dashboard-status"
              color={hasActiveSession ? 'success' : 'default'}
              size="sm"
              variant="soft"
            >
              {sessionStatus}
            </Chip>
          </Card.Header>
          <Card.Content className="dashboard-hero-content">
            <div className="dashboard-hero-grid">
              <div>
                <p className="intro">
                  Start with a spoken question, build your answer aloud, and get a chance to try
                  again with focused feedback.
                </p>
                <Button
                  className="dashboard-cta"
                  isDisabled={busy || isRestoring}
                  onPress={onStartPractice}
                  variant="primary"
                >
                  <span aria-hidden="true">▶</span> {actionLabel}
                </Button>
                <p className="dashboard-caption">
                  Aim for eight spoken answers, then review and re-speak one if useful. Finish early
                  whenever you need to; your answers are saved locally.
                </p>
              </div>
              <figure className={`nori-figure${isLoading ? ' is-running' : ''}`}>
                <span className="nori-stage" aria-hidden="true">
                  <span className="nori-speed-lines" />
                  <Rabbit className="nori-rabbit" strokeWidth={1.6} />
                </span>
                <figcaption>
                  {isLoading ? 'Nori is hopping along…' : 'Nori is cheering you on'}
                </figcaption>
              </figure>
            </div>
          </Card.Content>
        </Card>
        {error && (
          <div className="dashboard-error" role="alert">
            <span>{error}</span>
            <Button
              className="secondary-action text-xs"
              isDisabled={busy}
              onPress={onStartPractice}
              variant="secondary"
            >
              Try again
            </Button>
          </div>
        )}
      </section>

      <Card className="panel dashboard-card" variant="secondary">
        <Card.Header className="dashboard-card-header">
          <div>
            <p className="section-kicker">YOUR SESSION</p>
            <Card.Title className="section-title">A simple speaking loop</Card.Title>
          </div>
          <span className="session-length">8-answer goal · 10–15 min suggested</span>
        </Card.Header>
        <Card.Content className="dashboard-steps">
          <div className="dashboard-step">
            <span className="step-number">1</span>
            <div>
              <h2>Hear a question</h2>
              <p>The conversation opens with a prompt you can answer in your own words.</p>
            </div>
          </div>
          <div className="dashboard-step">
            <span className="step-number">2</span>
            <div>
              <h2>Speak and review</h2>
              <p>Record locally, review the transcript, and continue the conversation.</p>
            </div>
          </div>
          <div className="dashboard-step">
            <span className="step-number">3</span>
            <div>
              <h2>Strengthen and finish</h2>
              <p>
                Use focused feedback and Try Again if useful, then see your saved session counts.
              </p>
            </div>
          </div>
        </Card.Content>
      </Card>

      <MemorySnapshot onOpenMemory={onOpenMemory} />

      <div className="dashboard-note">
        <span aria-hidden="true" className="note-icon">
          ⌁
        </span>
        <p>
          Your conversation is saved locally. Leave for Learning Memory and return whenever you’re
          ready to continue.
        </p>
      </div>
    </div>
  );
}
