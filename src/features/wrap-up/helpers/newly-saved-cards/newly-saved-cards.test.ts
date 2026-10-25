import { describe, expect, it } from 'bun:test';
import { aCard } from '../../tests/builders';
import { newlySavedCards } from './index';

describe('newlySavedCards', () => {
  it('keeps only cards created by this save', () => {
    const cards = [
      aCard({ id: 1, created_at: 1_000 }),
      aCard({ id: 2, created_at: 5_000 }),
      aCard({ id: 3, created_at: 5_001 }),
    ];
    expect(newlySavedCards(cards, 5_000).map((card) => card.id)).toEqual([2, 3]);
  });

  it('returns nothing when every card already existed', () => {
    expect(newlySavedCards([aCard({ created_at: 100 })], 5_000)).toEqual([]);
  });
});
