import { describe, expect, it } from 'bun:test';
import { isReviewMaterials } from './reviewMaterialTypes';

const item = (position) => ({
  position,
  situation: 'A short situation.',
  model_answer: 'A concise model answer.',
  hint: null,
  is_cued: false,
});

describe('review material IPC', () => {
  it('accepts masked preparation states and up to six ordered review positions', () => {
    expect(
      isReviewMaterials({ run_id: 4, preparation: { state: 'pending' }, items: [item(1)] }),
    ).toBe(true);
    expect(
      isReviewMaterials({
        run_id: 4,
        preparation: { state: 'ready' },
        items: [item(1), item(2), item(3), item(4), item(5), item(6)],
      }),
    ).toBe(true);
    expect(
      isReviewMaterials({
        run_id: 4,
        preparation: { state: 'failed', error: { code: 'timeout', message: 'Retry.' } },
        items: [item(1)],
      }),
    ).toBe(true);
  });

  it('rejects invalid IDs, duplicate/out-of-order positions, and overlong prompt fields', () => {
    expect(
      isReviewMaterials({ run_id: 0, preparation: { state: 'legacy' }, items: [item(1)] }),
    ).toBe(false);
    expect(
      isReviewMaterials({ run_id: 4, preparation: { state: 'legacy' }, items: [item(2), item(1)] }),
    ).toBe(false);
    expect(
      isReviewMaterials({ run_id: 4, preparation: { state: 'legacy' }, items: [item(1), item(1)] }),
    ).toBe(false);
    expect(
      isReviewMaterials({ run_id: 4, preparation: { state: 'ready' }, items: [item(7)] }),
    ).toBe(false);
    expect(
      isReviewMaterials({
        run_id: 4,
        preparation: { state: 'ready' },
        items: [{ ...item(1), model_answer: 'x'.repeat(601) }],
      }),
    ).toBe(false);
    expect(
      isReviewMaterials({
        run_id: 4,
        preparation: { state: 'failed', error: { code: 'unknown', message: 'Retry.' } },
        items: [item(1)],
      }),
    ).toBe(false);
    expect(
      isReviewMaterials({
        run_id: 4,
        preparation: { state: 'ready' },
        items: [{ ...item(1), hint: 'target phrase', is_cued: false }],
      }),
    ).toBe(false);
    expect(isReviewMaterials({ run_id: 4, preparation: { state: 'legacy' }, items: [] })).toBe(
      false,
    );
  });
});
