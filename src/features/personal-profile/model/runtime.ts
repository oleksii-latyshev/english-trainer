import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { PersonalProfileService } from '../services/personal-profile-service';

export const runtime = Atom.runtime(PersonalProfileService.layer.pipe(Layer.provide(CoreLive)));
