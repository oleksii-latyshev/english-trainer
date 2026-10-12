import type { ConversationProvider } from '@/core/ipc';

export type ProviderCard = {
  readonly id: ConversationProvider;
  readonly name: string;
  readonly description: string;
  readonly badge?: string;
  readonly isLegacy?: boolean;
};

export const PROVIDER_CARDS: readonly ProviderCard[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    badge: 'Recommended',
    description: 'Fastest, most natural replies. Needs an API key.',
  },
  {
    id: 'apple',
    name: 'Apple on-device',
    description: 'Private and offline, shorter replies. Used as the backup.',
  },
  {
    id: 'agy',
    name: 'Antigravity',
    isLegacy: true,
    description: 'Slower. Kept for compatibility.',
  },
];
