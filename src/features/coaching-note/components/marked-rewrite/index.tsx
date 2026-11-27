import { highlightRewrite } from '../../helpers/rewrite-diff';

type Props = {
  transcript: string;
  rewrite: string;
};

export function MarkedRewrite({ transcript, rewrite }: Props) {
  return (
    <p className="text-body text-foreground leading-copy m-0" data-word-lookup>
      {highlightRewrite(transcript, rewrite).map((part, index) =>
        part.isChanged ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: The runs are positional output of one rewrite.
          <mark className="bg-ok-bg text-ok rounded-sm px-0.5" key={index}>
            {part.text}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: The runs are positional output of one rewrite.
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}
