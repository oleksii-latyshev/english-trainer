import { isProviderError, type ProviderError } from './types';

export type ReviewPreparation =
  | { state: 'legacy' }
  | { state: 'pending' }
  | { state: 'ready' }
  | { state: 'failed'; error: ProviderError };

export type ReviewMaterialView = {
  position: number;
  situation: string | null;
  model_answer: string | null;
  hint: string | null;
  is_cued: boolean;
};

export type ReviewMaterials = {
  run_id: number;
  preparation: ReviewPreparation;
  items: ReviewMaterialView[];
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isOptionalText(value: unknown, maxChars: number): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' && value.trim().length > 0 && Array.from(value).length <= maxChars)
  );
}

function isReviewPreparation(value: unknown): value is ReviewPreparation {
  if (typeof value !== 'object' || value === null || !('state' in value)) return false;
  switch (value.state) {
    case 'legacy':
    case 'pending':
    case 'ready':
      return true;
    case 'failed':
      return 'error' in value && isProviderError(value.error);
    default:
      return false;
  }
}

function isReviewMaterialView(value: unknown): value is ReviewMaterialView {
  return (
    typeof value === 'object' &&
    value !== null &&
    'position' in value &&
    isPositiveInteger(value.position) &&
    value.position <= 6 &&
    'situation' in value &&
    isOptionalText(value.situation, 500) &&
    'model_answer' in value &&
    isOptionalText(value.model_answer, 600) &&
    'hint' in value &&
    isOptionalText(value.hint, 300) &&
    'is_cued' in value &&
    typeof value.is_cued === 'boolean' &&
    (value.is_cued ? value.hint !== null : value.hint === null)
  );
}

export function isReviewMaterials(value: unknown): value is ReviewMaterials {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'run_id' in value &&
    isPositiveInteger(value.run_id) &&
    'preparation' in value &&
    isReviewPreparation(value.preparation) &&
    'items' in value &&
    Array.isArray(value.items) &&
    value.items.length >= 1 &&
    value.items.length <= 6 &&
    value.items.every(isReviewMaterialView) &&
    value.items.every(
      (item, index, items) => index === 0 || items[index - 1].position < item.position,
    )
  );
}
