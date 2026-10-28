import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export function useElementWidth() {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  const measure = useCallback(() => {
    const element = elementRef.current;
    if (element) setWidth(element.clientWidth);
  }, []);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);

  return { elementRef, width };
}
