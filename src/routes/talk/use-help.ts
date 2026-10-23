import { RegistryContext } from '@effect/atom-react';
import { isTauri } from '@tauri-apps/api/core';
import { useContext, useEffect, useRef, useState } from 'react';
import type { SessionDetails } from '@/core/practice-session';
import { createPlayback } from '@/core/speech';
import { type HelpLevel, helpLevelForPress } from '@/features/practice/lib/helpLevels';
import type { RecordingStatus } from '@/features/practice/practiceViewModel';
import { recordAnswerHelpUsed } from '@/features/practice/sessionApi';
import {
  exampleCueWasInterrupted,
  useExampleCaptureGuard,
} from '@/features/practice/useExampleCaptureGuard';
import { keyTarget } from '@/shared/helpers/key-target';

const HELP_NOT_MARKED = 'Help could not be marked. Try opening it again, or keep speaking.';

type Options = {
  session: SessionDetails | undefined;
  captureStatus: RecordingStatus;
  isHelpAvailable: boolean;
};

export function helpKeyOf(session: SessionDetails | undefined): string {
  if (session === undefined) return 'none';
  return `${session.sessionId}:${session.practicePhase}:${session.turnCount + 1}:${session.question}`;
}

export function useHelp({ session, captureStatus, isHelpAvailable }: Options) {
  const registry = useContext(RegistryContext);
  const helpKey = helpKeyOf(session);
  const currentHelpKey = useRef(helpKey);
  currentHelpKey.current = helpKey;
  const helpRequest = useRef(0);
  const requestedHelp = useRef<HelpLevel | null>(null);
  const [help, setHelp] = useState<{ key: string; level: HelpLevel | null }>({
    key: helpKey,
    level: null,
  });
  const [helpNotice, setHelpNotice] = useState<{ key: string; text: string } | null>(null);
  const helpLevel = help.key === helpKey ? help.level : null;
  const { captureEpoch, isCapturingRef } = useExampleCaptureGuard({
    captureStatus,
    helpLevel,
    helpKey,
    helpRequest,
    requestedHelp,
    setHelp,
    stopSpeech: () => createPlayback(registry).stop(),
  });

  function changeHelpLevel(level: HelpLevel | null) {
    if (level === 'example' && isCapturingRef.current) return;
    const request = ++helpRequest.current;
    const requestKey = helpKey;
    const requestCaptureEpoch = captureEpoch.current;
    const wasCapturingAtRequest = isCapturingRef.current;
    if (level === null || session === undefined) {
      requestedHelp.current = null;
      setHelp({ key: requestKey, level: null });
      return;
    }
    requestedHelp.current = level;
    setHelpNotice(null);
    if (!isTauri()) {
      requestedHelp.current = null;
      setHelp({ key: requestKey, level });
      return;
    }
    function isStale() {
      return helpRequest.current !== request || currentHelpKey.current !== requestKey;
    }
    void recordAnswerHelpUsed(session.sessionId, session.turnCount + 1)
      .then(() => {
        if (isStale()) return;
        requestedHelp.current = null;
        const interrupted = exampleCueWasInterrupted(
          wasCapturingAtRequest,
          requestCaptureEpoch,
          captureEpoch.current,
          isCapturingRef.current,
        );
        setHelp({ key: requestKey, level: level === 'example' && interrupted ? null : level });
      })
      .catch(() => {
        if (isStale()) return;
        requestedHelp.current = null;
        setHelp({ key: requestKey, level: null });
        setHelpNotice({ key: requestKey, text: HELP_NOT_MARKED });
      });
  }

  const latest = useRef({ helpLevel, isHelpAvailable, changeHelpLevel });
  latest.current = { helpLevel, isHelpAvailable, changeHelpLevel };

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.isComposing) return;
      const action = helpLevelForPress(
        {
          key: event.key,
          isRepeat: event.repeat,
          hasModifier: event.metaKey || event.ctrlKey || event.altKey,
          target: keyTarget(event.target),
        },
        latest.current,
      );
      if (action === null) return;
      event.preventDefault();
      latest.current.changeHelpLevel(action.level);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    helpKey,
    helpLevel,
    changeHelpLevel,
    helpNotice: helpNotice?.key === helpKey ? helpNotice.text : undefined,
  };
}
