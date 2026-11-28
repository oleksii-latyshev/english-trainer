import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { ConversationHistoryService } from '../services/conversation-history-service';

export const runtime = Atom.runtime(ConversationHistoryService.layer.pipe(Layer.provide(CoreLive)));
