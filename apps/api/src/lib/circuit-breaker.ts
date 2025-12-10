/**
 * Circuit Breaker Implementation
 * Prevents cascading failures by stopping requests to failing services
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are rejected immediately
 * - HALF_OPEN: Testing if service has recovered
 */

import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("circuit-breaker");

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting recovery (half-open) */
  resetTimeoutMs: number;
  /** Number of successful calls in half-open to close circuit */
  successThreshold: number;
  /** Optional: time window for failure counting (sliding window) */
  failureWindowMs?: number;
}

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailureTime: number;
  state: CircuitState;
  failureTimestamps: number[];
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minute
  successThreshold: 2,
  failureWindowMs: 60000, // Count failures in last minute
};

// In-memory circuit state (per-endpoint)
const circuits = new Map<string, CircuitStats>();

/**
 * Get or create circuit stats for an identifier
 */
function getCircuit(identifier: string): CircuitStats {
  let circuit = circuits.get(identifier);
  if (!circuit) {
    circuit = {
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      state: "CLOSED",
      failureTimestamps: [],
    };
    circuits.set(identifier, circuit);
  }
  return circuit;
}

/**
 * Clean up old failure timestamps outside the window
 */
function cleanupFailureWindow(circuit: CircuitStats, windowMs: number): void {
  const cutoff = Date.now() - windowMs;
  circuit.failureTimestamps = circuit.failureTimestamps.filter(ts => ts > cutoff);
  circuit.failures = circuit.failureTimestamps.length;
}

/**
 * Check if circuit allows the request
 */
export function canExecute(
  identifier: string,
  config: Partial<CircuitBreakerConfig> = {}
): { allowed: boolean; state: CircuitState; reason?: string } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const circuit = getCircuit(identifier);

  // Clean up old failures if using sliding window
  if (cfg.failureWindowMs) {
    cleanupFailureWindow(circuit, cfg.failureWindowMs);
  }

  switch (circuit.state) {
    case "CLOSED":
      return { allowed: true, state: "CLOSED" };

    case "OPEN": {
      // Check if reset timeout has passed
      const timeSinceFailure = Date.now() - circuit.lastFailureTime;
      if (timeSinceFailure >= cfg.resetTimeoutMs) {
        // Transition to half-open
        circuit.state = "HALF_OPEN";
        circuit.successes = 0;
        logger.info({ identifier }, "Circuit breaker transitioning to HALF_OPEN");
        return { allowed: true, state: "HALF_OPEN" };
      }
      return {
        allowed: false,
        state: "OPEN",
        reason: `Circuit open. Retry after ${Math.ceil((cfg.resetTimeoutMs - timeSinceFailure) / 1000)}s`,
      };
    }

    case "HALF_OPEN":
      // Allow limited requests to test recovery
      return { allowed: true, state: "HALF_OPEN" };

    default:
      return { allowed: true, state: "CLOSED" };
  }
}

/**
 * Record a successful execution
 */
export function recordSuccess(
  identifier: string,
  config: Partial<CircuitBreakerConfig> = {}
): void {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const circuit = getCircuit(identifier);

  if (circuit.state === "HALF_OPEN") {
    circuit.successes++;
    if (circuit.successes >= cfg.successThreshold) {
      // Recovery confirmed, close circuit
      circuit.state = "CLOSED";
      circuit.failures = 0;
      circuit.failureTimestamps = [];
      logger.info({ identifier }, "Circuit breaker CLOSED after recovery");
    }
  } else if (circuit.state === "CLOSED") {
    // Reset failure count on success (optional, for non-sliding window)
    if (!cfg.failureWindowMs) {
      circuit.failures = 0;
    }
  }
}

/**
 * Record a failed execution
 */
export function recordFailure(
  identifier: string,
  config: Partial<CircuitBreakerConfig> = {}
): void {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const circuit = getCircuit(identifier);
  const now = Date.now();

  circuit.failures++;
  circuit.lastFailureTime = now;
  circuit.failureTimestamps.push(now);

  // Clean up old timestamps
  if (cfg.failureWindowMs) {
    cleanupFailureWindow(circuit, cfg.failureWindowMs);
  }

  if (circuit.state === "HALF_OPEN") {
    // Failed during recovery test, reopen circuit
    circuit.state = "OPEN";
    logger.warn({ identifier }, "Circuit breaker re-opened after failed recovery");
  } else if (circuit.state === "CLOSED" && circuit.failures >= cfg.failureThreshold) {
    // Too many failures, open circuit
    circuit.state = "OPEN";
    logger.warn(
      { identifier, failures: circuit.failures },
      "Circuit breaker OPENED due to failures"
    );
  }
}

/**
 * Get current circuit state
 */
export function getCircuitState(identifier: string): CircuitStats {
  return getCircuit(identifier);
}

/**
 * Reset circuit (for testing or manual intervention)
 */
export function resetCircuit(identifier: string): void {
  circuits.delete(identifier);
  logger.info({ identifier }, "Circuit breaker reset");
}

/**
 * Get all circuit states (for monitoring)
 */
export function getAllCircuitStates(): Map<string, CircuitStats> {
  return new Map(circuits);
}

/**
 * Execute with circuit breaker protection
 */
export async function executeWithCircuitBreaker<T>(
  identifier: string,
  fn: () => Promise<T>,
  config: Partial<CircuitBreakerConfig> = {}
): Promise<{ success: true; result: T } | { success: false; error: string; circuitOpen: boolean }> {
  const check = canExecute(identifier, config);

  if (!check.allowed) {
    return {
      success: false,
      error: check.reason ?? "Circuit breaker open",
      circuitOpen: true,
    };
  }

  try {
    const result = await fn();
    recordSuccess(identifier, config);
    return { success: true, result };
  } catch (error) {
    recordFailure(identifier, config);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      circuitOpen: false,
    };
  }
}

// Webhook-specific circuit breaker config
export const WEBHOOK_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5, // Open after 5 consecutive failures
  resetTimeoutMs: 5 * 60 * 1000, // 5 minutes before retry
  successThreshold: 2, // 2 successes to fully recover
  failureWindowMs: 5 * 60 * 1000, // Count failures in 5-minute window
};
