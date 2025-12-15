import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "../use-mobile";

describe("useIsMobile", () => {
  const originalInnerWidth = window.innerWidth;
  let matchMediaListeners: Map<string, Set<(e: MediaQueryListEvent) => void>>;

  beforeEach(() => {
    matchMediaListeners = new Map();

    // Mock matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => {
        if (!matchMediaListeners.has(query)) {
          matchMediaListeners.set(query, new Set());
        }
        return {
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(), // Deprecated
          removeListener: vi.fn(), // Deprecated
          addEventListener: vi.fn((_, listener) => {
            matchMediaListeners.get(query)?.add(listener);
          }),
          removeEventListener: vi.fn((_, listener) => {
            matchMediaListeners.get(query)?.delete(listener);
          }),
          dispatchEvent: vi.fn(),
        };
      }),
    });
  });

  afterEach(() => {
    // Restore original innerWidth
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: originalInnerWidth,
    });
  });

  it("returns false for desktop width (>= 768px)", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true for mobile width (< 768px)", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 400,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("returns false for exactly 768px (breakpoint)", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 768,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true for 767px (just below breakpoint)", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 767,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("responds to window resize via matchMedia change event", () => {
    // Start with desktop width
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    // Simulate resize to mobile
    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        value: 500,
      });

      // Trigger the change event
      const listeners = matchMediaListeners.get("(max-width: 767px)");
      listeners?.forEach((listener) => {
        listener({ matches: true } as MediaQueryListEvent);
      });
    });

    expect(result.current).toBe(true);
  });

  it("cleans up event listener on unmount", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 1024,
    });

    // Capture the matchMedia result before rendering
    let removeEventListenerSpy: ReturnType<typeof vi.fn>;
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => {
        removeEventListenerSpy = vi.fn();
        return {
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: removeEventListenerSpy,
          dispatchEvent: vi.fn(),
        };
      }),
    });

    const { unmount } = renderHook(() => useIsMobile());
    unmount();

    // Verify removeEventListener was called during cleanup
    expect(removeEventListenerSpy!).toHaveBeenCalledWith("change", expect.any(Function));

    // Restore original mock
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: originalMatchMedia,
    });
  });

  it("uses correct breakpoint query", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 1024,
    });

    renderHook(() => useIsMobile());

    // Verify matchMedia was called with the correct query
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });
});
