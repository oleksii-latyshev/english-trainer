import { BODY_COLOURS, type BodyId, type EvaLook } from '../../palette';

export function withBody(look: EvaLook, body: BodyId): EvaLook {
  const chosen = BODY_COLOURS.find((option) => option.id === body);
  return chosen ? { ...look, body, ink: chosen.ink } : look;
}
