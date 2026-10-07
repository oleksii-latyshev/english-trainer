import { useEffect, useRef } from 'react';
import { keyTarget } from '@/components/keyTarget';
import {
  decideReviewKeyDown,
  decideReviewKeyUp,
  type ReviewKeyCommand,
  type ReviewKeyContext,
} from './lib/reviewKeys';

type Options = Omit<ReviewKeyContext, 'isHoldingSpace'> & {
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onStopEva: () => void;
};

function runCommand(command: ReviewKeyCommand, options: Options, isHolding: { current: boolean }) {
  if (command.kind === 'hold-to-talk') {
    isHolding.current = true;
    options.onStart();
  }
  if (command.kind === 'cancel-listening') options.onCancel();
  if (command.kind === 'stop-eva') options.onStopEva();
}

/**
 * The spoken review's keyboard: hold Space to answer, Esc to cancel or to stop Eva. What each key
 * means is decided in `lib/reviewKeys.ts`; this hook only listens and runs the result.
 */
export function useReviewKeyboard(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const isHoldingRef = useRef(false);

  useEffect(() => {
    const holding = isHoldingRef;

    function release() {
      const current = latest.current;
      const outcome = decideReviewKeyUp(' ', {
        listening: current.listening,
        isHoldingSpace: holding.current,
      });
      holding.current = false;
      if (outcome === 'stop-listening') current.onStop();
      if (outcome === 'cancel-listening') current.onCancel();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.isComposing) return;
      const current = latest.current;
      const command = decideReviewKeyDown(
        {
          key: event.key,
          isRepeat: event.repeat,
          hasModifier: event.metaKey || event.ctrlKey || event.altKey,
          target: keyTarget(event.target),
        },
        {
          canStart: current.canStart,
          listening: current.listening,
          isEvaSpeaking: current.isEvaSpeaking,
          isHoldingSpace: holding.current,
        },
      );
      if (!command) return;
      event.preventDefault();
      runCommand(command, current, holding);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === ' ') release();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    // A key released while the window is not focused never reports its keyup.
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', release);
    };
  }, []);
}
