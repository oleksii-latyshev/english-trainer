import { Fragment } from 'react';
import { markedWords } from '../../helpers/marked-words';

type Props = { said: string; corrected: string };

export function MarkedSentence({ said, corrected }: Props) {
  return (
    <>
      {markedWords(said, corrected).map((word, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the words are a fixed ordered sequence
        <Fragment key={index}>
          {index > 0 && ' '}
          {word.isMarked ? (
            <mark className="bg-ok-soft text-ok-text rounded-sm px-0.5">{word.text}</mark>
          ) : (
            word.text
          )}
        </Fragment>
      ))}
    </>
  );
}
