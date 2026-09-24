import { Button, Card, Slider } from '@heroui/react';
import type { useSystemSpeech } from './useSystemSpeech';

type SpeechPanelProps = {
  speech: ReturnType<typeof useSystemSpeech>;
  transcript?: string;
};

export function SpeechPanel({ speech, transcript }: SpeechPanelProps) {
  const speechAvailable = speech.state.tag !== 'unavailable';
  const speechActive =
    speech.state.tag === 'starting' ||
    speech.state.tag === 'speaking' ||
    speech.state.tag === 'paused';
  const englishVoices = speech.voices.filter((option) => option.isEnglish);
  const visibleVoices = englishVoices.length > 0 ? englishVoices : speech.voices;

  return (
    <aside className="voice-column" aria-label="Voice playback settings">
      <Card className="panel voice-panel" variant="secondary">
        <Card.Header className="panel-header">
          <div>
            <p className="section-kicker">LISTEN BACK</p>
            <Card.Title className="section-title">System voice</Card.Title>
          </div>
          <span className="speaker-glyph" aria-hidden="true">
            ◖))
          </span>
        </Card.Header>
        <Card.Content className="panel-content voice-content">
          <p className="voice-description">
            Hear your transcript with a system voice. Choose a voice and a pace that feels
            comfortable.
          </p>
          <label className="field-label" htmlFor="system-voice">
            Voice
          </label>
          <select
            id="system-voice"
            className="voice-select"
            disabled={!speechAvailable || visibleVoices.length === 0}
            onChange={(event) => speech.selectVoice(event.target.value)}
            value={speech.selectedVoiceURI ?? ''}
          >
            {visibleVoices.length === 0 && <option value="">No voices available</option>}
            {visibleVoices.map(({ voice, isEnglish }) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} · {voice.lang}
                {isEnglish ? '' : ' (other language)'}
              </option>
            ))}
          </select>
          <div className="rate-heading">
            <span className="field-label">Playback speed</span>
            <output>{speech.rate.toFixed(2)}×</output>
          </div>
          <Slider
            aria-label="Playback speed"
            className="speed-slider"
            maxValue={1.2}
            minValue={0.85}
            onChange={(value) => speech.setRate(typeof value === 'number' ? value : value[0])}
            step={0.05}
            value={speech.rate}
          >
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider>
          <div className="rate-bounds">
            <span>0.85×</span>
            <span>1.20×</span>
          </div>
          <div className="voice-actions flex flex-wrap gap-2">
            <Button
              className="secondary-action"
              isDisabled={!speechAvailable || visibleVoices.length === 0}
              onPress={() =>
                speech.play(transcript ?? 'Hello! This is your English Trainer voice.')
              }
              variant="secondary"
            >
              {transcript ? 'Replay transcript' : 'Test voice'}
            </Button>
            {speech.state.tag === 'speaking' && (
              <Button className="subtle-action" onPress={speech.pause} variant="tertiary">
                Pause
              </Button>
            )}
            {speech.state.tag === 'paused' && (
              <Button className="subtle-action" onPress={speech.resume} variant="tertiary">
                Resume
              </Button>
            )}
            {speechActive && (
              <Button className="subtle-action" onPress={speech.stop} variant="tertiary">
                Stop
              </Button>
            )}
          </div>
          {speech.state.tag === 'error' && (
            <p className="error-message" role="alert">
              {speech.state.reason === 'voices-unavailable'
                ? 'System voices are not ready yet. Try again in a moment.'
                : 'Voice playback failed. Try another voice.'}
            </p>
          )}
          {!speechAvailable && (
            <p className="error-message" role="alert">
              System speech is unavailable in this WebView.
            </p>
          )}
        </Card.Content>
      </Card>
      <div className="privacy-note">
        <span aria-hidden="true">◎</span>
        <p>
          <strong>Private by default</strong>
          <br />
          Audio is processed locally and discarded after transcription or when you record again.
        </p>
      </div>
    </aside>
  );
}
