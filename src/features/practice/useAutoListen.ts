import { type MutableRefObject, useRef } from 'react';

/**
 * Starts listening once the assistant's reply finished by itself, unless a newer send replaced
 * it or the screen is no longer ready for an answer (busy, retrying, recalling, another screen).
 */
export function useAutoListen(
  ready: boolean,
  generation: MutableRefObject<number>,
  startAutoListen: () => void,
) {
  const readyRef = useRef(ready);
  readyRef.current = ready;
  return (requestId: number) => {
    if (requestId === generation.current && readyRef.current) startAutoListen();
  };
}
