import { useAtom } from '@effect/atom-react';
import { SearchField } from '@/shared/ui/search-field';
import { searchQueryAtom } from '../../model/atoms';

export function MemorySearch() {
  const [query, setQuery] = useAtom(searchQueryAtom);
  return (
    <SearchField
      className="w-80 max-narrow:w-full"
      label="Search memory"
      onValueChange={setQuery}
      placeholder="Search phrases and mistakes"
      value={query}
    />
  );
}
