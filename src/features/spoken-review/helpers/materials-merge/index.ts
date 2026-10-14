import type { ReviewMaterials } from '@/core/learning-memory';

const PREPARATION_RANK = { legacy: 0, pending: 1, failed: 2, ready: 3 } as const;

export function mergeReviewMaterials(
  current: ReviewMaterials | null,
  incoming: ReviewMaterials,
): ReviewMaterials {
  if (!current || current.run_id !== incoming.run_id) return incoming;
  const currentByPosition = new Map(current.items.map((item) => [item.position, item]));
  return {
    ...incoming,
    preparation:
      PREPARATION_RANK[current.preparation.state] > PREPARATION_RANK[incoming.preparation.state]
        ? current.preparation
        : incoming.preparation,
    items: incoming.items.map((item) => {
      const old = currentByPosition.get(item.position);
      if (!old) return item;
      return {
        ...item,
        situation: item.situation ?? old.situation,
        model_answer: item.model_answer ?? old.model_answer,
        hint: item.hint ?? old.hint,
        is_cued: item.is_cued || old.is_cued,
      };
    }),
  };
}
