import type { UsageEventRecord } from '@/core/ipc';

export type EvidenceTone = 'own' | 'slip';

export function evidenceTone(event: Pick<UsageEventRecord, 'outcome'>): EvidenceTone {
  return event.outcome === 'correct' ? 'own' : 'slip';
}

export function evidenceTag(event: Pick<UsageEventRecord, 'outcome'>): string {
  return evidenceTone(event) === 'own' ? 'On your own' : 'Slipped back';
}

export function evidenceDate(timestampMs: number): string {
  return new Date(timestampMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function evidenceSource(event: Pick<UsageEventRecord, 'origin'>): string {
  return event.origin === 'feedback' ? 'From Eva’s note' : 'From the usage review';
}
