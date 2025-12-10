import { useEffect, useRef, useCallback } from "react";
import type { UseFormWatch, FieldValues } from "react-hook-form";

interface UseDebouncedFormWatchOptions {
  delay?: number;
}

export function useDebouncedFormWatch<T extends FieldValues>(
  watch: UseFormWatch<T>,
  onSave: (data: T) => void,
  options: UseDebouncedFormWatchOptions = {}
) {
  const { delay = 1000 } = options;
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onSaveRef = useRef(onSave);

  // Keep onSave ref updated to avoid stale closures
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    const subscription = watch((data) => {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        onSaveRef.current(data as T);
      }, delay);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutRef.current);
    };
  }, [watch, delay]);

  const flush = useCallback(() => {
    clearTimeout(timeoutRef.current);
  }, []);

  return { flush };
}
