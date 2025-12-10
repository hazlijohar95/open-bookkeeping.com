import { useSyncExternalStore, useCallback } from "react";

const BREAKPOINTS = {
  "MOBILE:768": 768,
  "TABLET:1024": 1024,
  "DESKTOP:1280": 1280,
  "LARGE_DESKTOP:1536": 1536,
} as const;

export function useIsBreakpoint(breakpoint: keyof typeof BREAKPOINTS): boolean {
  const breakpointValue = BREAKPOINTS[breakpoint];

  const subscribe = useCallback(
    (callback: () => void): (() => void) => {
      const mql = window.matchMedia(`(max-width: ${breakpointValue - 1}px)`);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [breakpointValue]
  );

  const getSnapshot = useCallback((): boolean => {
    return window.innerWidth < breakpointValue;
  }, [breakpointValue]);

  const getServerSnapshot = useCallback((): boolean => {
    return false; // Default for SSR
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
