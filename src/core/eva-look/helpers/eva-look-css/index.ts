import {
  BODY_COLOURS,
  type EvaLook,
  INK_COLOURS,
  LEAF_COLOURS,
  PETAL_COLOURS,
} from '../../palette';

function findOrFirst<T extends { readonly id: string }>(options: readonly T[], id: string): T {
  const match = options.find((option) => option.id === id);
  return match ?? (options[0] as T);
}

export function evaLookCssVars(look: EvaLook): Record<string, string> {
  const [hi, mid, edge, shade] = findOrFirst(BODY_COLOURS, look.body).stops;
  const leaf = findOrFirst(LEAF_COLOURS, look.leaf);
  const petal = findOrFirst(PETAL_COLOURS, look.petal);
  return {
    '--eva-body-hi': hi,
    '--eva-body-mid': mid,
    '--eva-body-edge': edge,
    '--eva-body-shade': shade,
    '--eva-ink': findOrFirst(INK_COLOURS, look.ink).colour,
    '--eva-leaf-light': leaf.light,
    '--eva-leaf-dark': leaf.dark,
    '--eva-petal': petal.petal,
    '--eva-petal-centre': petal.centre,
  };
}
