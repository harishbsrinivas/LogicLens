// Token bucket rate limiter used by the HTTP layer.
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly clock: Clock = systemClock,
  ) {
    if (capacity <= 0 || refillPerSecond <= 0) {
      throw new RangeError('capacity and refill rate must be positive');
    }
    this.tokens = capacity;
    this.last = clock.now();
  }

  private refill(): void {
    const now = this.clock.now();
    const elapsed = (now - this.last) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
    this.last = now;
  }

  tryTake(cost = 1): boolean {
    this.refill();
    if (this.tokens < cost) {
      return false;
    }
    this.tokens -= cost;
    return true;
  }

  /** Milliseconds until `cost` tokens are available. */
  waitTime(cost = 1): number {
    this.refill();
    const missing = cost - this.tokens;
    return missing <= 0 ? 0 : Math.ceil((missing / this.refillPerSecond) * 1000);
  }
}

export async function withLimit<T>(bucket: TokenBucket, task: () => Promise<T>): Promise<T> {
  for (;;) {
    if (bucket.tryTake()) {
      return task();
    }
    await new Promise((resolve) => setTimeout(resolve, bucket.waitTime()));
  }
}
