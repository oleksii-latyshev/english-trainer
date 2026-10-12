import { Context, Effect, Layer } from 'effect';
import { Ipc, invokeCommand, type PersonalProfile, PersonalProfileSchema } from '@/core/ipc';
import type { PersonalProfileFailure } from '../types';

type PersonalProfileServiceShape = {
  readonly get: Effect.Effect<PersonalProfile, PersonalProfileFailure>;
  readonly save: (
    profile: PersonalProfile,
  ) => Effect.Effect<PersonalProfile, PersonalProfileFailure>;
};

export class PersonalProfileService extends Context.Service<
  PersonalProfileService,
  PersonalProfileServiceShape
>()('features/personal-profile/PersonalProfileService') {
  static readonly layer = Layer.effect(
    PersonalProfileService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        get: invokeCommand(ipc, 'get_personal_profile', PersonalProfileSchema),
        save: (profile) =>
          invokeCommand(ipc, 'save_personal_profile', PersonalProfileSchema, { profile }),
      };
    }),
  );
}
