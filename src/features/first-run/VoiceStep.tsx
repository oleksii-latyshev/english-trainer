import { useEffect, useRef } from 'react';
import { Eva } from '@/components/eva/Eva';
import { useTrainer } from '@/context/TrainerContext';
import { SegmentedControl } from '@/features/settings/SettingsControls';
import { SPEECH_RATE_OPTIONS } from '@/features/speech/voicePreferences';
import { voiceChoices } from './lib/voiceChoices';

const PREVIEW_LINE = 'Hi! What have you been up to today?';

const RATE_OPTIONS = SPEECH_RATE_OPTIONS.map((rate) => ({
  value: rate,
  label: `${rate.toFixed(1)}×`,
}));

/** Step 3: Eva's voice and speed; picking a voice plays the sample line in it. */
export function VoiceStep() {
  const { speech } = useTrainer();
  const stopRef = useRef(speech.stop);
  useEffect(() => {
    stopRef.current = speech.stop;
  });
  const isPlaying = speech.state.tag === 'starting' || speech.state.tag === 'speaking';
  const choices = voiceChoices(
    speech.voices.map((option) => option.voice),
    speech.selectedVoiceURI,
  );

  // Leaving the step (Back, Skip, Start talking) cuts off a sample that is still playing.
  useEffect(() => () => stopRef.current(), []);

  return (
    <>
      <div className="first-run-hero first-run-hero-row">
        <Eva decorative mood={isPlaying ? 'speaking' : 'happy'} size={132} />
        <div className="first-run-copy">
          <h1>Pick Eva's voice</h1>
          <p>Choose one you'd enjoy listening to every day.</p>
        </div>
      </div>

      {choices.length === 0 ? (
        <p className="first-run-alert" role="status">
          No English voices are available right now. Eva's voice uses the voices installed in macOS;
          add one in System Settings → Accessibility → Spoken Content.
        </p>
      ) : (
        <div aria-label="Voice" className="first-run-choices" role="radiogroup">
          {choices.map((choice) => {
            const selected = choice.voiceURI === speech.selectedVoiceURI;
            return (
              // biome-ignore lint/a11y/useSemanticElements: a card that plays its sample again when chosen again needs a button, which a radio input does not report.
              <button
                aria-checked={selected}
                className="first-run-choice"
                data-on={selected}
                key={choice.voiceURI}
                onClick={() => {
                  speech.selectVoice(choice.voiceURI);
                  speech.play(PREVIEW_LINE, undefined, undefined, choice.voiceURI);
                }}
                role="radio"
                type="button"
              >
                <span aria-hidden="true" className="first-run-dot" />
                <span className="first-run-choice-copy">
                  <span className="first-run-choice-title">{choice.name}</span>
                  <span className="first-run-choice-text">{choice.description}</span>
                </span>
                <span className="first-run-choice-side">
                  {selected ? `“${PREVIEW_LINE}”` : 'Preview'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="first-run-speed">
        <span className="first-run-label">Speed</span>
        <SegmentedControl
          label="Speed"
          onChange={speech.setRate}
          options={RATE_OPTIONS}
          value={SPEECH_RATE_OPTIONS.find((rate) => rate === speech.rate)}
        />
      </div>

      {speech.state.tag === 'error' && (
        <p className="first-run-alert" role="alert">
          Voice playback is unavailable.
        </p>
      )}
    </>
  );
}
