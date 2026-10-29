import { Effect } from 'effect';
import { MISTAKES, MistakesService, mistakesRuntime } from '@/core/mistakes';
import { toast } from '@/shared/ui/toast';

export const archiveMistakeAtom = mistakesRuntime.fn(
  Effect.fn('archiveMistake')(
    function* (input: { readonly id: number; readonly onArchived: () => void }) {
      const service = yield* MistakesService;
      yield* service.archive(input.id);
      toast('Archived. It stays out of your practice.');
      input.onArchived();
    },
    Effect.tapError(() =>
      Effect.sync(() => toast.danger('Could not archive that. Please try again.')),
    ),
  ),
  { reactivityKeys: MISTAKES },
);

export const retryLessonAtom = mistakesRuntime.fn(
  Effect.fn('retryLesson')(
    function* (id: number) {
      const service = yield* MistakesService;
      yield* service.retryLesson(id);
    },
    Effect.tapError(() =>
      Effect.sync(() => toast.danger('Could not restart the lesson. Please try again.')),
    ),
  ),
  { reactivityKeys: MISTAKES },
);
