import type { UsageEventRecord } from '@/core/ipc';

export type EvidenceTone = 'own' | 'quiet';

type Outcome = Pick<UsageEventRecord, 'outcome'>;

export function isShownEvidence(event: Outcome): boolean {
  return event.outcome !== 'uncertain';
}

export function evidenceTone(event: Outcome): EvidenceTone {
  return event.outcome === 'correct' ? 'own' : 'quiet';
}

export function evidenceTag(event: Outcome): string {
  switch (event.outcome) {
    case 'correct':
      return 'On your own';
    case 'with_help':
      return 'With help';
    default:
      return 'Slipped back';
  }
}

export function evidenceDate(timestampMs: number): string {
  return new Date(timestampMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function evidenceSource(event: Pick<UsageEventRecord, 'origin'>): string {
  return event.origin === 'feedback' ? 'From Eva’s note' : 'From the usage review';
}
