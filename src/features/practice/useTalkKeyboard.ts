import { useEffect, useRef } from 'react';
import { keyTarget } from '@/components/keyTarget';
import type { HelpLevel } from './lib/helpLevels';
import { decideKeyDown, decideKeyUp, shouldKeepTurnOpen } from './lib/talkKeys';
import type { TurnState } from './lib/turnState';

type Options = {
  state: TurnState;
  canPressMic: boolean;
  isHelpAvailable: boolean;
  helpLevel: HelpLevel | null;
  onHelpLevelChange: (level: HelpLevel | null) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onCancelCountdown: () => void;
  /** Keeps the turn open (no end-of-turn by silence) while true. */
  onHoldListening: (isHeld: boolean) => void;
  onStopEva: () => void;
};

/**
 * Talk's keyboard: hold Space to talk, Esc to cancel or stop Eva, H / 2 / 3 for help. What each key
 * means is decided in `lib/talkKeys.ts`; this hook only listens and runs the result.
 */
export function useTalkKeyboard(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const isHoldingRef = useRef(false);
  const keyboardStartPendingRef = useRef(false);
  const keyboardStartAbandonedRef = useRef(false);

  // The recording only goes live after the press, so the hold is applied once audio flows.
  useEffect(() => {
    const isListening = options.state.tag === 'listening' || options.state.tag === 'auto-listen';
    if (keyboardStartPendingRef.current && isListening) {
      keyboardStartPendingRef.current = false;
      if (keyboardStartAbandonedRef.current) {
        keyboardStartAbandonedRef.current = false;
        options.onCancelRecording();
        return;
      }
    }
    if (
      keyboardStartPendingRef.current &&
      (options.state.tag === 'transcribing' || options.state.tag === 'error')
    ) {
      keyboardStartPendingRef.current = false;
      keyboardStartAbandonedRef.current = false;
    }
    if (shouldKeepTurnOpen(options.state, isHoldingRef.current)) options.onHoldListening(true);
  }, [options.state, options.onCancelRecording, options.onHoldListening]);

  useEffect(() => {
    const holding = isHoldingRef;

    function release() {
      const current = latest.current;
      const wasHolding = holding.current;
      const outcome = decideKeyUp(' ', { state: current.state, isHoldingSpace: holding.current });
      holding.current = false;
      if (outcome) {
        keyboardStartPendingRef.current = false;
        keyboardStartAbandonedRef.current = false;
      } else if (wasHolding && keyboardStartPendingRef.current) {
        keyboardStartAbandonedRef.current = true;
      }
      if (outcome === 'stop-listening') current.onStopRecording();
      if (outcome === 'cancel-listening') current.onCancelRecording();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.isComposing) return;
      const current = latest.current;
      const command = decideKeyDown(
        {
          key: event.key,
          isRepeat: event.repeat,
          hasModifier: event.metaKey || event.ctrlKey || event.altKey,
          target: keyTarget(event.target),
        },
        {
          state: current.state,
          canPressMic: current.canPressMic,
          isCountingDown:
            current.state.tag === 'review' && current.state.sendingLabel !== undefined,
          helpLevel: current.helpLevel,
          isHelpAvailable: current.isHelpAvailable,
          isHoldingSpace: holding.current,
        },
      );
      if (!command) return;
      event.preventDefault();
      switch (command.kind) {
        case 'hold-to-talk':
          holding.current = true;
          keyboardStartPendingRef.current = true;
          keyboardStartAbandonedRef.current = false;
          current.onStartRecording();
          return;
        case 'adopt-listening':
          holding.current = true;
          keyboardStartPendingRef.current = false;
          keyboardStartAbandonedRef.current = false;
          current.onHoldListening(true);
          return;
        case 'cancel-listening':
          keyboardStartPendingRef.current = false;
          keyboardStartAbandonedRef.current = false;
          current.onCancelRecording();
          return;
        case 'cancel-countdown':
          current.onCancelCountdown();
          return;
        case 'stop-eva':
          current.onStopEva();
          return;
        case 'set-help':
          current.onHelpLevelChange(command.level);
          return;
      }
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
