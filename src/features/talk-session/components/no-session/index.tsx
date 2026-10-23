import { Button } from '@/shared/ui/button';

type Props = {
  isDisabled: boolean;
  onStart: () => void;
};

export function NoSession({ isDisabled, onStart }: Props) {
  return (
    <section
      aria-label="Your voice, in English."
      className="mx-auto flex h-full max-w-120 flex-col items-center justify-center gap-4 text-center"
    >
      <h1 className="m-0 font-bold text-large-title">Your voice, in English.</h1>
      <p className="m-0 text-body text-muted">Start a conversation with Eva to begin.</p>
      <Button disabled={isDisabled} onClick={onStart} tone="primary">
        Start practice
      </Button>
    </section>
  );
}
