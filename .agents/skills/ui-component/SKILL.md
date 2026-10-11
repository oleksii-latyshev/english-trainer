---
name: ui-component
description: Find or create a basic UI control (button, input, switch, tabs, dialog, tooltip, toast, chip, kbd…) for English Trainer. Use whenever a component needs a control that is not built yet, before writing any styled element in a feature or screen.
---

# UI kit component

1. **Look first:** `ls src/shared/ui/`. If the control exists, use it through its public props; extend
   it with a new variant there if the design needs one. Never restyle it from a feature.
2. **Create when missing:** `src/shared/ui/<kebab-name>/`
   - `index.tsx` wraps the matching Base UI primitive (`@base-ui/react`; check exports in
     `node_modules/@base-ui/react/` before guessing an API) or a semantic element when Base UI has
     none. Function component, `type Props`, named export, forwards `className` for layout only.
   - `styles.ts` holds the `tv()` recipe (`import { tv } from '@/shared/ui/tv'`; add any new token
     class group there so tailwind-merge keeps it): base classes plus variants (`tone`, `size`, …) on theme
     tokens (`bg-surface`, `text-muted`, `rounded-card`); every state the design shows — hover,
     `focus-visible`, `disabled`, pressed/checked (Base UI exposes `data-*` attributes for them).
   - `index.ts` of the kit is not used; import `@/shared/ui/<name>`.
3. Generic only: no product words, no IPC, no atoms. Accessible name, keyboard and focus behaviour
   come from Base UI; keep them.
4. Match the approved design (`docs/DESIGN.md`, glass canvas). No `.css`, no hex, no `[...]` values,
   no comments. Check with `bun run check && bun run check:conventions`.
