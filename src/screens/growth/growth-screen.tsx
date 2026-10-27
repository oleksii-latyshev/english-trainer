import { HowItGrows, StageStrip, TodayCard } from '@/features/eva-growth';

export function GrowthScreen() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3">
      <StageStrip />
      <div className="max-narrow:grid-cols-1 grid grid-cols-2 gap-3">
        <HowItGrows />
        <TodayCard />
      </div>
    </div>
  );
}
