import type { ModelRequests } from '@/core/ipc';

export function usageShare(entry: ModelRequests, models: readonly ModelRequests[]): number {
  const busiest = Math.max(...models.map((model) => model.requests));
  return busiest === 0 ? 0 : Math.round((entry.requests / busiest) * 100);
}
