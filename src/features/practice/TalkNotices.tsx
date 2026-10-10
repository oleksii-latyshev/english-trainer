import { TurnNotice } from '@/components/TurnNotice';

export function TalkNotices(props: { practiceError: string; voiceError?: string }) {
  return (
    <>
      {props.practiceError && <TurnNotice message={props.practiceError} />}
      {props.voiceError && <TurnNotice message={props.voiceError} />}
    </>
  );
}
