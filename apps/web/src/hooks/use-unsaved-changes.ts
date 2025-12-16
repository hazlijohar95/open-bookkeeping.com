import { useEffect, useCallback } from "react";

/**
 * Hook to warn users about unsaved changes before leaving the page.
 * Uses the browser's native beforeunload event.
 *
 * @param isDirty - Whether there are unsaved changes
 * @param message - Optional custom message (browsers may ignore this)
 *
 * @example
 * ```tsx
 * const form = useForm();
 * useUnsavedChanges(form.formState.isDirty);
 * ```
 */
export function useUnsavedChanges(
  isDirty: boolean,
  message = "You have unsaved changes. Are you sure you want to leave?"
): void {
  const handleBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        // Modern browsers require returnValue to be set
        e.returnValue = message;
        return message;
      }
    },
    [isDirty, message]
  );

  useEffect(() => {
    if (isDirty) {
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }
  }, [isDirty, handleBeforeUnload]);
}

export default useUnsavedChanges;
