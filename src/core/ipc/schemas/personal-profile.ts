import { Schema } from 'effect';
import type { PersonalProfile } from '../bindings/PersonalProfile';
import { bindingSchema } from './binding-schema';

export const PersonalProfileSchema = bindingSchema<PersonalProfile>()(
  Schema.Struct({
    role: Schema.String,
    stack: Schema.String,
    interests: Schema.String,
    goals: Schema.String,
  }),
);
