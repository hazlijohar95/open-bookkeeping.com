import { useEffect, useRef, useState, type RefObject } from "react";

interface UseContainerWidthReturn<T extends HTMLElement> {
  ref: RefObject<T | null>;
  width: number;
}

export function useContainerWidth<
  T extends HTMLElement = HTMLDivElement,
>(): UseContainerWidthReturn<T> {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(element);
    setWidth(element.clientWidth);

    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
