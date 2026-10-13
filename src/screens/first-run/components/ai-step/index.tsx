import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { aiSettingsAtom } from '@/core/ai-settings';
import { ProviderList } from '@/features/ai-provider';
import { GeminiKeyList, geminiKeyStatusAtom } from '@/features/gemini-key';
import { StepLayout } from '../step-layout';

export function AiStep() {
  const provider = Option.getOrNull(AsyncResult.value(useAtomValue(aiSettingsAtom)))?.provider;
  const keyStatus = Option.getOrNull(AsyncResult.value(useAtomValue(geminiKeyStatusAtom)));
  const isReady = provider === 'apple' || keyStatus?.configured === true;
  return (
    <StepLayout mood={isReady ? 'happy' : 'idle'} step="ai">
      <div className="flex flex-col gap-4">
        <ProviderList />
        {provider === 'gemini' && <GeminiKeyList />}
      </div>
    </StepLayout>
  );
}
