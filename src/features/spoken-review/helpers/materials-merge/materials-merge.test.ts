import { describe, expect, it } from 'bun:test';
import type { ReviewMaterials } from '@/core/learning-memory';
import { mergeReviewMaterials } from './index';

const ready: ReviewMaterials = {
  run_id: 5,
  preparation: { state: 'ready' },
  items: [
    {
      position: 1,
      situation: 'At work…',
      model_answer: 'Use a compromise.',
      hint: 'compromise',
      is_cued: true,
    },
  ],
};

describe('review material snapshots', () => {
  it('does not let a delayed pending read erase generated or revealed material', () => {
    const delayed: ReviewMaterials = {
      run_id: 5,
      preparation: { state: 'pending' },
      items: [{ position: 1, situation: null, model_answer: null, hint: null, is_cued: false }],
    };
    expect(mergeReviewMaterials(ready, delayed)).toEqual(ready);
  });

  it('takes the snapshot of another run as it is', () => {
    expect(mergeReviewMaterials(ready, { ...ready, run_id: 6 })).toEqual({ ...ready, run_id: 6 });
  });

  it('starts from the first snapshot', () => {
    expect(mergeReviewMaterials(null, ready)).toEqual(ready);
  });
});
