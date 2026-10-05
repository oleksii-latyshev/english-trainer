function getErrorName(error: unknown): string {
  if (error instanceof DOMException) return error.name;
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof error.name === 'string'
  ) {
    return error.name;
  }
  return '';
}

export function microphoneError(error: unknown): string {
  const name = getErrorName(error);

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone access was denied. Allow access in macOS System Settings → Privacy & Security → Microphone, then try again.';
  }
  if (name === 'OverconstrainedError') {
    return 'The selected microphone is unavailable. Reconnect it or choose another device in Settings.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found. Connect one and try again.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The microphone is busy or unavailable. Close other apps using it and try again.';
  }

  return error instanceof Error ? error.message : 'Recording failed. Please try again.';
}
