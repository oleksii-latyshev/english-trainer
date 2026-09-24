import { PracticeView } from '@/features/practice/PracticeView';
import { usePracticeSession } from '@/features/practice/usePracticeSession';
import { useSpeechCapture } from '@/features/speech/useSpeechCapture';
import { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import './App.css';

function App() {
  const speech = useSystemSpeech();
  const capture = useSpeechCapture(speech);
  const practice = usePracticeSession({
    canChangeSession: capture.canChangeSession,
    resetCapture: capture.reset,
    playQuestion: speech.play,
    stopSpeech: speech.stop,
  });
  const currentRequestId = capture.view.currentRequestId;
  const isBusy =
    practice.isBusy || capture.view.status === 'requesting' || capture.view.status === 'stopping';

  return (
    <PracticeView
      model={{
        ...capture.view,
        practice: practice.state,
        practiceError: practice.error,
        busy: isBusy,
      }}
      actions={{
        startRecording: capture.startRecording,
        stopRecording: capture.stopRecording,
        transcribeRecording: capture.transcribeRecording,
        startPractice: practice.start,
        finishPractice: practice.finish,
        handlePracticeTurn: practice.acceptTurn,
        isCurrent: () => capture.isCurrentRequest(currentRequestId),
        onTurnPendingChange: practice.onTurnPendingChange,
      }}
      speech={speech}
    />
  );
}

export default App;
