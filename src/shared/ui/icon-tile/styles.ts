import { tv } from '@/shared/ui/tv';

export const iconTile = tv({
  base: 'flex size-7 svg:size-4 flex-none items-center justify-center rounded-lg text-white',
  variants: {
    tone: {
      red: 'bg-tile-red',
      green: 'bg-tile-green',
      grey: 'bg-tile-grey',
      sky: 'bg-linear-to-br from-tile-sky-from to-tile-sky-to',
    },
  },
  defaultVariants: { tone: 'grey' },
});
