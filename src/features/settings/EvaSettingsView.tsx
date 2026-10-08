import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Eva } from '@/components/eva/Eva';
import { DOCK_ICONS, dockIconPreference } from '@/lib/dockIcon';
import {
  DEFAULT_EVA_LOOK,
  EVA_MOTIONS,
  EYE_COLOURS,
  evaLookPreference,
  SPHERE_COLOURS,
  sphereGradient,
  withSphere,
} from '@/lib/evaLook';
import { EVA_MOOD_GUIDE, nextMoodIndex } from './lib/evaMoods';
import { SegmentedControl, SettingsButton } from './SettingsControls';
import './settings.css';
import './settingsEva.css';

const MOTION_OPTIONS = EVA_MOTIONS.map((motion) => ({ value: motion.id, label: motion.label }));
const MOOD_CYCLE_MS = 2200;

function Swatch({
  name,
  background,
  isSelected,
  onSelect,
}: {
  name: string;
  background: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-label={name}
      aria-pressed={isSelected}
      className="settings-swatch"
      onClick={onSelect}
      style={{ background }}
      title={name}
      type="button"
    />
  );
}

export function EvaSettingsView() {
  const navigate = useNavigate();
  const [look, setLook] = evaLookPreference.use();
  const [dockIcon, setDockIcon] = dockIconPreference.use();
  const [moodIndex, setMoodIndex] = useState(0);
  const [isCycling, setIsCycling] = useState(true);

  useEffect(() => {
    if (!isCycling) return;
    const timer = setInterval(() => setMoodIndex(nextMoodIndex), MOOD_CYCLE_MS);
    return () => clearInterval(timer);
  }, [isCycling]);

  const currentMood = EVA_MOOD_GUIDE[moodIndex] ?? EVA_MOOD_GUIDE[0];
  const sphere = SPHERE_COLOURS.find((option) => option.id === look.sphere) ?? SPHERE_COLOURS[0];
  const eye = EYE_COLOURS.find((option) => option.id === look.eye) ?? EYE_COLOURS[0];
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
          <SettingsButton onClick={() => setIsCycling(!isCycling)} variant="ghost">
            {isCycling ? 'Pause preview' : 'Play all moods'}
          </SettingsButton>
        </div>
        <div className="settings-look-controls">
          <h2 id="eva-look-heading">Look</h2>
          <div className="settings-look-field">
            <div className="settings-label">Sphere</div>
            <fieldset className="settings-swatches">
              <legend className="sr-only">Sphere colour</legend>
              {SPHERE_COLOURS.map((option) => (
                <Swatch
                  background={sphereGradient(option.id)}
                  isSelected={look.sphere === option.id}
                  key={option.id}
                  name={option.name}
                  onSelect={() => setLook(withSphere(look, option.id))}
                />
              ))}
            </fieldset>
            <div className="settings-look-value">{sphere.name} sphere</div>
          </div>
          <div className="settings-look-field">
            <div className="settings-label">Eyes</div>
            <fieldset className="settings-swatches">
              <legend className="sr-only">Eye colour</legend>
              {EYE_COLOURS.map((option) => (
                <Swatch
                  background={option.color}
                  isSelected={look.eye === option.id}
                  key={option.id}
                  name={option.name}
                  onSelect={() => setLook({ eye: option.id })}
                />
              ))}
            </fieldset>
            <div className="settings-look-value">{eye.name} eyes</div>
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
              Only the Dock changes; Finder and Launchpad keep the default icon.
            </span>
          </div>
          <div className="settings-look-reset">
            <SettingsButton onClick={() => setLook(DEFAULT_EVA_LOOK)} variant="ghost">
              Reset to default
            </SettingsButton>
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
        <p className="settings-quiet">
          The ring around Eva shows whose turn it is: teal while you speak, violet while Eva speaks
          or thinks.
        </p>
      </section>
    </div>
  );
}
