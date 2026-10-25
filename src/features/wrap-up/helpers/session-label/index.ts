import type { FinishedSession } from '../../types';
import { formatDuration } from '../duration';

type Mode = FinishedSession['practice_mode'];
type Phase = FinishedSession['practice_phase'];

function modeLabel(mode: Mode): string {
  switch (mode) {
    case 'voice':
      return 'Speak';
    case 'text_chat':
      return 'Text chat';
    case 'write_then_speak':
      return 'Write, then speak';
  }
}

function phaseLabel(phase: Phase): string {
  switch (phase) {
    case 'writing':
      return 'Writing';
    case 'writing_review':
      return 'Review writing';
    case 'speaking':
      return 'Speaking';
    case 'speaking_review':
      return 'Review speaking';
  }
}

export function sessionLabel(summary: FinishedSession): string {
  const duration = formatDuration(summary.duration_ms);
  if (summary.is_mistake_practice) return `Usual mistakes practice · ${duration}`;
  const mode = modeLabel(summary.practice_mode);
  const phase = phaseLabel(summary.practice_phase);
  return `${summary.topic_label} · ${mode} · ${phase} · ${duration}`;
}
