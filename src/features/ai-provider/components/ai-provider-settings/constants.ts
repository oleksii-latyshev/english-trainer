import type { AgyModel, EvaStyle } from '@/core/ipc';

export const AGY_MODEL_OPTIONS: readonly { value: AgyModel; label: string }[] = [
  { value: 'default', label: 'Gemini 3.8 Flash Medium (recommended)' },
  { value: 'gemini-3.8-flash-low', label: 'Gemini 3.8 Flash Low' },
  { value: 'gemini-3.8-flash-high', label: 'Gemini 3.8 Flash High' },
];

export const EVA_STYLE_OPTIONS: readonly { value: EvaStyle; label: string }[] = [
  { value: 'natural', label: 'Natural' },
  { value: 'short_and_simple', label: 'Short and simple' },
];
