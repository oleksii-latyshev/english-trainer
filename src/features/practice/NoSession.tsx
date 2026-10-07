import { Button } from '@heroui/react';

type Props = {
  title: string;
  text: string;
  actionLabel: string;
  isDisabled: boolean;
  onStart: () => void;
};

/** Shown when a Talk route opens without a conversation, e.g. while one is still being restored. */
export function NoSession({ title, text, actionLabel, isDisabled, onStart }: Props) {
  return (
    <section aria-label={title} className="talk-empty">
      <h1>{title}</h1>
      <p>{text}</p>
      <Button isDisabled={isDisabled} onPress={onStart} variant="primary">
        {actionLabel}
      </Button>
    </section>
  );
}
