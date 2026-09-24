export function microphoneError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'Microphone access was denied. Allow access in macOS System Settings → Privacy & Security → Microphone, then try again.';
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'No microphone was found. Connect one and try again.';
    }
    if (error.name === 'NotReadableError') {
      return 'The microphone is busy or unavailable. Close other apps using it and try again.';
    }
  }
  return error instanceof Error ? error.message : 'Recording failed. Please try again.';
}
