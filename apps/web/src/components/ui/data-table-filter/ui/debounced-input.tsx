"use client";

import { useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { debounce } from "../lib/debounce";

export function DebouncedInput({
  value: externalValue,
  onChange,
  debounceMs = 500,
  ...props
}: {
  value: string | number;
  onChange: (value: string | number) => void;
  debounceMs?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  // Track if user is actively typing - if so, use local state; otherwise use external value
  const [localValue, setLocalValue] = useState<string | number | null>(null);
  const isTypingRef = useRef(false);

  // Use local value while typing, external value otherwise
  const displayValue = isTypingRef.current && localValue !== null ? localValue : externalValue;

   
  const debouncedOnChange = useCallback(
    debounce((newValue: string | number) => {
      onChange(newValue);
      // After debounce fires, stop using local value
      isTypingRef.current = false;
      setLocalValue(null);
    }, debounceMs),
    [debounceMs, onChange],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    isTypingRef.current = true;
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  };

  return <Input {...props} value={displayValue} onChange={handleChange} />;
}
