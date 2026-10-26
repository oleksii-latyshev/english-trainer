export type GrowthSeed = {
  drops: number;
  stage: number;
  stage_floor: number;
  next_threshold: number | null;
  napping: boolean;
  today: {
    speaking: { drops: number; topic: string }[];
    sunshine: { drops: number; phrase: string }[];
  };
};

export const quietSeed: GrowthSeed = {
  drops: 0,
  stage: 0,
  stage_floor: 0,
  next_threshold: 10,
  napping: false,
  today: { speaking: [], sunshine: [] },
};

export const budSeed: GrowthSeed = {
  drops: 80,
  stage: 3,
  stage_floor: 60,
  next_threshold: 100,
  napping: false,
  today: {
    speaking: [{ drops: 12, topic: 'Explaining a bug' }],
    sunshine: [{ drops: 5, phrase: 'most of' }],
  },
};
