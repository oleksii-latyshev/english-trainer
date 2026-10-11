import { useAtom } from '@effect/atom-react';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  BODY_COLOURS,
  bodySwatch,
  DEFAULT_EVA_LOOK,
  EVA_MOTIONS,
  evaLookAtom,
  INK_COLOURS,
  LEAF_COLOURS,
  leafSwatch,
  PETAL_COLOURS,
  petalSwatch,
  withBody,
} from '@/core/eva-look';
import { DOCK_ICONS, dockIconPreference } from '@/lib/dockIcon';
import { Button } from '@/shared/ui/button';
import { Eva } from '@/shared/ui/eva';
import { EVA_MOOD_GUIDE, nextMoodIndex } from './lib/evaMoods';
import { SegmentedControl } from './SettingsControls';
import './settings.css';
import './settingsEva.css';

const MOTION_OPTIONS = EVA_MOTIONS.map((motion) => ({ value: motion.id, label: motion.label }));
const MOOD_CYCLE_MS = 2200;

function Swatch({
  name,
  background,
  isSelected,
  lockedHint,
  onSelect,
}: {
  name: string;
  background: string;
  isSelected: boolean;
  lockedHint?: string;
  onSelect: () => void;
}) {
  return (
    <button
      aria-label={name}
      aria-pressed={isSelected}
      className="settings-swatch"
      disabled={lockedHint !== undefined}
      onClick={onSelect}
      style={{ background, opacity: lockedHint === undefined ? undefined : 0.35 }}
      title={lockedHint ?? name}
      type="button"
    />
  );
}

export function EvaSettingsView() {
  const navigate = useNavigate();
  const [look, setLookValue] = useAtom(evaLookAtom);
  const setLook = (patch: Partial<typeof look>) => setLookValue({ ...look, ...patch });
  const [dockIcon, setDockIcon] = dockIconPreference.use();
  const [moodIndex, setMoodIndex] = useState(0);
  const [isCycling, setIsCycling] = useState(true);

  useEffect(() => {
    if (!isCycling) return;
    const timer = setInterval(() => setMoodIndex(nextMoodIndex), MOOD_CYCLE_MS);
    return () => clearInterval(timer);
  }, [isCycling]);

  const currentMood = EVA_MOOD_GUIDE[moodIndex] ?? EVA_MOOD_GUIDE[0];
  const body = BODY_COLOURS.find((option) => option.id === look.body) ?? BODY_COLOURS[0];
  const ink = INK_COLOURS.find((option) => option.id === look.ink) ?? INK_COLOURS[0];
  const leaf = LEAF_COLOURS.find((option) => option.id === look.leaf) ?? LEAF_COLOURS[0];
  const petal = PETAL_COLOURS.find((option) => option.id === look.petal) ?? PETAL_COLOURS[0];
  const motion = EVA_MOTIONS.find((option) => option.id === look.motion) ?? EVA_MOTIONS[0];

  return (
    <div className="settings settings-eva">
      <div className="settings-eva-head">
        <button
          className="settings-link"
          onClick={() => void navigate({ to: '/settings' })}
          type="button"
        >
          ← Settings
        </button>
        <h1>Eva</h1>
        <p>How your conversation partner looks, and what her face is telling you.</p>
      </div>

      <section aria-labelledby="eva-look-heading" className="settings-group settings-look">
        <div className="settings-preview">
          <Eva label={`Eva preview, ${currentMood.name}`} mood={currentMood.mood} size={200} />
          <div className="settings-preview-name">{currentMood.name}</div>
          <Button onClick={() => setIsCycling(!isCycling)} tone="ghost">
            {isCycling ? 'Pause preview' : 'Play all moods'}
          </Button>
        </div>
        <div className="settings-look-controls">
          <h2 id="eva-look-heading">Look</h2>
          <div className="settings-look-field">
            <div className="settings-label">Body</div>
            <fieldset className="settings-swatches">
              <legend className="sr-only">Body colour</legend>
              {BODY_COLOURS.map((option) => (
                <Swatch
                  background={bodySwatch(option)}
                  isSelected={look.body === option.id}
                  key={option.id}
                  name={option.name}
                  onSelect={() => setLookValue(withBody(look, option.id))}
                />
              ))}
            </fieldset>
            <div className="settings-look-value">{body.name}</div>
          </div>
          <div className="settings-look-field">
            <div className="settings-label">Eyes</div>
            <fieldset className="settings-swatches">
              <legend className="sr-only">Eye colour</legend>
              {INK_COLOURS.map((option) => (
                <Swatch
                  background={option.colour}
                  isSelected={look.ink === option.id}
                  key={option.id}
                  name={option.name}
                  onSelect={() => setLook({ ink: option.id })}
                />
              ))}
            </fieldset>
            <div className="settings-look-value">{ink.name} eyes</div>
          </div>
          <div className="settings-look-field">
            <div className="settings-label">Leaves</div>
            <fieldset className="settings-swatches">
              <legend className="sr-only">Leaf colour</legend>
              {LEAF_COLOURS.map((option) => (
                <Swatch
                  background={leafSwatch(option)}
                  isSelected={look.leaf === option.id}
                  key={option.id}
                  lockedHint={'lockedHint' in option ? option.lockedHint : undefined}
                  name={option.name}
                  onSelect={() => setLook({ leaf: option.id })}
                />
              ))}
            </fieldset>
            <div className="settings-look-value">{leaf.name} leaves</div>
          </div>
          <div className="settings-look-field">
            <div className="settings-label">Bloom</div>
            <fieldset className="settings-swatches">
              <legend className="sr-only">Bloom colour</legend>
              {PETAL_COLOURS.map((option) => (
                <Swatch
                  background={petalSwatch(option)}
                  isSelected={look.petal === option.id}
                  key={option.id}
                  lockedHint={'lockedHint' in option ? option.lockedHint : undefined}
                  name={option.name}
                  onSelect={() => setLook({ petal: option.id })}
                />
              ))}
            </fieldset>
            <div className="settings-look-value">{petal.name}</div>
          </div>
          <div className="settings-look-inline">
            <div className="settings-label">Animation</div>
            <SegmentedControl
              label="Animation"
              onChange={(next) => setLook({ motion: next })}
              options={MOTION_OPTIONS}
              value={look.motion}
            />
            <span className="settings-quiet">{motion.hint}</span>
          </div>
          <div className="settings-look-inline">
            <div className="settings-label">Dock icon</div>
            <SegmentedControl
              label="Dock icon"
              onChange={(next) => setDockIcon({ icon: next })}
              options={DOCK_ICONS}
              value={dockIcon.icon}
            />
            <span className="settings-quiet">
              Only the Dock changes; Finder and Launchpad keep Eva's icon.
            </span>
          </div>
          <div className="settings-look-reset">
            <Button onClick={() => setLookValue(DEFAULT_EVA_LOOK)} tone="ghost">
              Reset to default
            </Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="eva-moods-heading" className="settings-group settings-moods">
        <div className="settings-moods-head">
          <h2 id="eva-moods-heading">What Eva's face means</h2>
          <span className="settings-quiet">Click one to preview it</span>
        </div>
        <ul className="settings-moods-grid">
          {EVA_MOOD_GUIDE.map((entry, index) => (
            <li key={entry.mood}>
              <button
                aria-pressed={index === moodIndex}
                className="settings-mood"
                onClick={() => {
                  setMoodIndex(index);
                  setIsCycling(false);
                }}
                type="button"
              >
                <Eva decorative mood={entry.mood} size={72} />
                <span className="settings-mood-name">{entry.name}</span>
                <span className="settings-mood-when">{entry.when}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
