import { Effect, Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { PersonalProfile } from '@/core/ipc';
import { ProfileTooLong } from '../errors';
import { firstFieldOverLimit, learnerName } from '../helpers/profile';
import { PersonalProfileService } from '../services/personal-profile-service';
import { runtime } from './runtime';

const PERSONAL_PROFILE = ['personal-profile'];

export const personalProfileAtom = runtime
  .atom(
    Effect.gen(function* () {
      const service = yield* PersonalProfileService;
      return yield* service.get;
    }),
  )
  .pipe(Atom.runtime.withReactivity(PERSONAL_PROFILE));

export const learnerNameAtom = Atom.make((get): string =>
  Option.match(AsyncResult.value(get(personalProfileAtom)), {
    onNone: () => '',
    onSome: learnerName,
  }),
);

export const profileDraftAtom = Atom.make<PersonalProfile | null>(null);

export const savePersonalProfileAtom = runtime.fn(
  Effect.fn('savePersonalProfile')(function* (profile: PersonalProfile, get: Atom.FnContext) {
    const tooLong = firstFieldOverLimit(profile);
    if (tooLong) {
      return yield* new ProfileTooLong({ field: tooLong.label, limit: tooLong.limit });
    }
    const service = yield* PersonalProfileService;
    const saved = yield* service.save(profile);
    get.set(profileDraftAtom, null);
    return saved;
  }),
  { reactivityKeys: PERSONAL_PROFILE },
);
