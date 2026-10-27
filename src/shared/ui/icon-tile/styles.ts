import { tv } from '@/shared/ui/tv';

export const iconTile = tv({
  base: 'svg:size-4 flex size-7 flex-none items-center justify-center rounded-lg text-white',
  variants: {
    tone: {
      red: 'bg-tile-red',
      green: 'bg-tile-green',
      grey: 'bg-tile-grey',
      sky: 'from-tile-sky-from to-tile-sky-to bg-linear-to-br',
    },
  },
  defaultVariants: { tone: 'grey' },
});
