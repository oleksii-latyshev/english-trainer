import type { KeySource } from '@/core/ipc';

export function keySourceLabel(source: KeySource): string {
  switch (source) {
    case 'environment':
      return 'Using the ENG_TRAINER_GEMINI_API_KEY environment variable';
    case 'settings':
      return 'Saved, encrypted on this Mac';
    default:
      return source satisfies never;
  }
}
