import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useState } from 'react';
import { AlertDialog } from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { Notice } from '@/shared/ui/notice';
import { ProgressBar } from '@/shared/ui/progress-bar';
import { DOWNLOAD_FAILED, settledFailureMessage } from '../../helpers/failure-copy';
import { downloadProgressText, formatSize } from '../../helpers/speech-check';
import {
  cancelModelDownloadAtom,
  downloadModelAtom,
  modelDownloadProgressAtom,
  speechModelOfferAtom,
} from '../../model/atoms';

export function ModelDownload() {
  const offer = Option.getOrUndefined(AsyncResult.value(useAtomValue(speechModelOfferAtom)));
  const result = useAtomValue(downloadModelAtom);
  const progress = Option.getOrUndefined(useAtomValue(modelDownloadProgressAtom));
  const download = useAtomSet(downloadModelAtom);
  const cancel = useAtomSet(cancelModelDownloadAtom);
  const [isAsking, setIsAsking] = useState(false);
  const isDownloading = AsyncResult.isWaiting(result);
  const failure = settledFailureMessage(result, DOWNLOAD_FAILED);
  const hasJustInstalled = AsyncResult.isSuccess(result) && offer?.is_installed === true;

  if (!offer) return null;
  if (offer.is_installed && !hasJustInstalled && !isDownloading) return null;
  const size = formatSize(offer.size_bytes);

  function startDownload() {
    setIsAsking(false);
    download(undefined);
  }

  return (
    <>
      <FormRow
        description={`${size}, downloaded once from Hugging Face and then used offline. Nothing else is sent.`}
        title="Speech model"
      >
        {!offer.is_installed && !isDownloading && (
          <Button onClick={() => setIsAsking(true)} tone="primary">
            {failure ? 'Try again' : 'Download'}
          </Button>
        )}
        {isDownloading && (
          <Button onClick={() => cancel(undefined)} tone="secondary">
            Cancel
          </Button>
        )}
      </FormRow>
      {isDownloading && (
        <Notice role="status" tone="quiet">
          <ProgressBar
            className="mb-1.5"
            label="Speech model download"
            max={progress?.total_bytes ?? offer.size_bytes}
            value={progress?.downloaded_bytes ?? 0}
          />
          <p>{downloadProgressText(progress)}</p>
        </Notice>
      )}
      {failure && (
        <Notice role="alert" tone="error">
          {failure}
        </Notice>
      )}
      {hasJustInstalled && (
        <Notice role="status" tone="quiet">
          Speech model ready.
        </Notice>
      )}
      <AlertDialog
        actions={
          <>
            <Button onClick={() => setIsAsking(false)} tone="secondary">
              Not now
            </Button>
            <Button onClick={startDownload} tone="primary">
              Download {size}
            </Button>
          </>
        }
        className="max-w-105"
        onOpenChange={setIsAsking}
        open={isAsking}
        title="Download the speech model?"
      >
        <p>
          English Trainer needs a {size} model from huggingface.co to hear you. It is saved on this
          computer, and your speech never leaves it.
        </p>
      </AlertDialog>
    </>
  );
}
