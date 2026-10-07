import { useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import {
  FIRST_RUN_STEPS,
  type FirstRunStepId,
  firstRunMarker,
  nextStep,
  previousStep,
  stepIndicators,
} from '@/lib/firstRun';
import { MicrophoneStep } from './MicrophoneStep';
import { ProviderStep } from './ProviderStep';
import { VoiceStep } from './VoiceStep';
import './firstRun.css';
import './firstRunControls.css';

/**
 * First run (docs/ui/DESIGN_BRIEF.md 6.9): three short steps, skippable, ending on the Talk start
 * screen. Finish and Skip both record the marker so launch never shows it again; opening it from
 * Settings later uses the same screen.
 */
export function FirstRunView() {
  const [step, setStep] = useState<FirstRunStepId>(FIRST_RUN_STEPS[0].id);
  const [micAllowed, setMicAllowed] = useState(false);
  const navigate = useNavigate();
  const onMicAllowed = useCallback(() => setMicAllowed(true), []);

  const back = previousStep(step);
  const next = nextStep(step);

  function leave(status: 'finished' | 'skipped') {
    firstRunMarker.set({ status });
    void navigate({ to: '/' });
  }

  return (
    <div className="first-run">
      <header className="first-run-header">
        <div className="first-run-brand">English Trainer</div>
        <ol aria-label="Setup steps" className="first-run-steps">
          {stepIndicators(step).map((indicator) => (
            <li
              aria-current={indicator.status === 'current' ? 'step' : undefined}
              className="first-run-step"
              data-status={indicator.status}
              key={indicator.id}
            >
              <b>{indicator.badge}</b>
              {indicator.label}
            </li>
          ))}
        </ol>
        <button
          className="first-run-button first-run-button-ghost first-run-button-small"
          onClick={() => leave('skipped')}
          type="button"
        >
          Skip setup
        </button>
      </header>

      <main className="first-run-main">
        <div className="first-run-column">
          {step === 'microphone' && (
            <MicrophoneStep allowed={micAllowed} onAllowed={onMicAllowed} />
          )}
          {step === 'ai' && <ProviderStep />}
          {step === 'voice' && <VoiceStep />}

          <footer className="first-run-footer">
            {back && (
              <button
                className="first-run-button first-run-button-ghost"
                onClick={() => setStep(back)}
                type="button"
              >
                Back
              </button>
            )}
            {next ? (
              <button
                className="first-run-button first-run-button-primary first-run-footer-end"
                onClick={() => setStep(next)}
                type="button"
              >
                Continue
              </button>
            ) : (
              <button
                className="first-run-button first-run-button-primary first-run-footer-end"
                onClick={() => leave('finished')}
                type="button"
              >
                Start talking
              </button>
            )}
          </footer>
        </div>
      </main>
    </div>
  );
}
