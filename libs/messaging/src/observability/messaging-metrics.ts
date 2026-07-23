type CounterMap = Map<string, number>;
type HistogramEntry = { count: number; totalMs: number; maxMs: number };

/**
 * Lightweight in-process metrics hooks — replace with Prometheus/App Insights in production if needed.
 */
export class MessagingMetrics {
  readonly #published = new Map<string, number>();
  readonly #consumed = new Map<string, number>();
  readonly #failed = new Map<string, number>();
  readonly #deadLettered = new Map<string, number>();
  readonly #durations = new Map<string, HistogramEntry>();

  incrementPublished(queueName: string): void {
    this.#increment(this.#published, queueName);
  }

  incrementConsumed(queueName: string): void {
    this.#increment(this.#consumed, queueName);
  }

  incrementFailed(queueName: string): void {
    this.#increment(this.#failed, queueName);
  }

  incrementDeadLettered(queueName: string): void {
    this.#increment(this.#deadLettered, queueName);
  }

  recordDuration(queueName: string, durationMs: number): void {
    const existing = this.#durations.get(queueName) ?? { count: 0, totalMs: 0, maxMs: 0 };
    existing.count += 1;
    existing.totalMs += durationMs;
    existing.maxMs = Math.max(existing.maxMs, durationMs);
    this.#durations.set(queueName, existing);
  }

  getSnapshot(): {
    published: Record<string, number>;
    consumed: Record<string, number>;
    failed: Record<string, number>;
    deadLettered: Record<string, number>;
    durations: Record<string, { count: number; avgMs: number; maxMs: number }>;
  } {
    return {
      published: Object.fromEntries(this.#published),
      consumed: Object.fromEntries(this.#consumed),
      failed: Object.fromEntries(this.#failed),
      deadLettered: Object.fromEntries(this.#deadLettered),
      durations: Object.fromEntries(
        [...this.#durations.entries()].map(([queue, stats]) => [
          queue,
          {
            count: stats.count,
            avgMs: stats.count > 0 ? Math.round(stats.totalMs / stats.count) : 0,
            maxMs: stats.maxMs,
          },
        ]),
      ),
    };
  }

  #increment(map: CounterMap, key: string): void {
    map.set(key, (map.get(key) ?? 0) + 1);
  }
}

export const messagingMetrics = new MessagingMetrics();
