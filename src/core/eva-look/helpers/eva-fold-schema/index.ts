import { Schema } from 'effect';
import { withFallback } from '@/shared/schema/with-fallback';

export const EvaFoldedSchema = withFallback(Schema.Boolean, false);
