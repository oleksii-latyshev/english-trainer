import { useCallback, useState } from 'react';
import {
  FIRST_RUN_STEPS,
  type FirstRunStepId,
  nextStep,
  previousStep,
  stepProgress,
} from '@/core/first-run';
import { Button } from '@/shared/ui/button';
import { AiStep } from './components/ai-step';
import { MicrophoneStep } from './components/microphone-step';
import { StepBars } from './components/step-bars';
import { VoiceStep } from './components/voice-step';
import type { FirstRunScreenProps } from './types';

export function FirstRunScreen({
  isPracticeCapturing,
  onBeforeMicrophoneCheck,
  onFinish,
  onSkip,
}: FirstRunScreenProps) {
  const [step, setStep] = useState<FirstRunStepId>(FIRST_RUN_STEPS[0].id);
  const [isMicrophoneAllowed, setIsMicrophoneAllowed] = useState(false);
  const allowMicrophone = useCallback(() => setIsMicrophoneAllowed(true), []);
  const back = previousStep(step);
  const next = nextStep(step);
  const isContinueShown = next !== undefined && (step !== 'microphone' || isMicrophoneAllowed);

  return (
    <div className="first-run flex min-h-0 flex-1 flex-col">
      <header className="grid h-16 flex-none grid-cols-[1fr_auto_1fr] items-center px-6">
        <span className="font-bold text-body">English Trainer</span>
        <StepBars steps={stepProgress(step)} />
        <Button className="justify-self-end" onClick={onSkip} tone="ghost">
          Skip setup
        </Button>
      </header>
      <main className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 pt-10 pb-12">
        {step === 'microphone' && (
          <MicrophoneStep
            isAllowed={isMicrophoneAllowed}
            isPracticeCapturing={isPracticeCapturing}
            onAllowed={allowMicrophone}
            onBeforeStart={onBeforeMicrophoneCheck}
          />
        )}
        {step === 'ai' && <AiStep />}
        {step === 'voice' && <VoiceStep />}
        <div className="mt-6 flex w-full max-w-115 items-center">
          {back && (
            <Button onClick={() => setStep(back)} tone="ghost">
              Back
            </Button>
          )}
          <span className="flex-1" />
          {isContinueShown && (
            <Button onClick={() => setStep(next)} tone="primary">
              Continue
            </Button>
          )}
          {next === undefined && (
            <Button onClick={onFinish} tone="primary">
              Start Talking
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
