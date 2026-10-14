import { RegistryContext } from '@effect/atom-react';
import { useContext } from 'react';
import { type ReviewCommands, reviewCommands } from './commands';

export function useReviewCommands(): ReviewCommands {
  return reviewCommands(useContext(RegistryContext));
}
