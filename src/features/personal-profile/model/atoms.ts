import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type { PersonalProfile } from '@/core/ipc';
import { ProfileTooLong } from '../errors';
import { exceedsFieldLimit, MAX_PROFILE_FIELD_CHARS } from '../helpers/profile';
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

export const profileDraftAtom = Atom.make<PersonalProfile | null>(null);

export const savePersonalProfileAtom = runtime.fn(
  Effect.fn('savePersonalProfile')(function* (profile: PersonalProfile, get: Atom.FnContext) {
    if (exceedsFieldLimit(profile)) {
      return yield* new ProfileTooLong({ limit: MAX_PROFILE_FIELD_CHARS });
    }
    const service = yield* PersonalProfileService;
    const saved = yield* service.save(profile);
    get.set(profileDraftAtom, null);
    return saved;
  }),
  { reactivityKeys: PERSONAL_PROFILE },
);
