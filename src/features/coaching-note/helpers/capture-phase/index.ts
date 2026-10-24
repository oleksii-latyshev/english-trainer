import type { CaptureState } from '@/core/answer-capture';

export type CapturePhase =
  | 'idle'
  | 'requesting'
  | 'capturing'
  | 'transcribing'
  | 'comparing'
  | 'kept'
  | 'failed';

export function capturePhaseOf(state: CaptureState): CapturePhase {
  switch (state.tag) {
    case 'idle':
      return 'idle';
    case 'requesting':
      return 'requesting';
    case 'recording':
    case 'stopping':
      return 'capturing';
    case 'transcribing':
      return 'transcribing';
    case 'transcript':
      return 'comparing';
    case 'ready':
      return 'kept';
    case 'error':
      return 'failed';
  }
}
