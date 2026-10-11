import { createTV } from 'tailwind-variants';

export const tv = createTV({
  twMergeConfig: {
    override: { conflictingClassGroups: { 'font-size': [] } },
    extend: {
      classGroups: {
        'font-size': [{ text: ['caption', 'control', 'body'] }],
        leading: [{ leading: ['copy'] }],
        rounded: [{ rounded: ['card', 'nav', 'control'] }],
        shadow: [{ shadow: ['overlay', 'control', 'primary', 'sky', 'glow', 'knob', 'key'] }],
      },
    },
  },
});
