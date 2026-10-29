import { useAtom } from '@effect/atom-react';
import { SearchField } from '@/shared/ui/search-field';
import { searchQueryAtom } from '../../model/atoms';

export function MemorySearch() {
  const [query, setQuery] = useAtom(searchQueryAtom);
  return (
    <SearchField
      className="max-narrow:w-full w-80"
      label="Search memory"
      onValueChange={setQuery}
      placeholder="Search phrases"
      value={query}
    />
  );
}
