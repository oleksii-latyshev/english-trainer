import { EvaLookControls } from '../eva-look-controls';
import { EvaMoodGuide } from '../eva-mood-guide';
import { EvaPreview } from '../eva-preview';

export function EvaSettings() {
  return (
    <div className="flex flex-col gap-3">
      <div className="max-narrow:flex-col flex gap-3">
        <EvaPreview />
        <EvaLookControls />
      </div>
      <EvaMoodGuide />
    </div>
  );
}
