import { logger } from "../utils/logger.js";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * In-memory TTL cache for API responses.
 * Reduces ADO API calls by caching frequently accessed data.
 */
export class ApiCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 5 * 60 * 1000) {
    // Default: 5 minutes
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Get a value from cache. Returns undefined if not found or expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      logger.debug({ key }, "Cache entry expired");
      return undefined;
    }

    logger.debug({ key }, "Cache hit");
    return entry.data as T;
  }

  /**
   * Set a value in cache with optional custom TTL.
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.store.set(key, { data, expiresAt });
    logger.debug({ key, ttlMs: ttlMs ?? this.defaultTtlMs }, "Cache set");
  }

  /**
   * Get or compute: returns cached value if available, otherwise calls
   * the factory function and caches the result.
   */
  async getOrCompute<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs?: number,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;

    const data = await factory();
    this.set(key, data, ttlMs);
    return data;
  }

  /**
   * Invalidate a specific cache entry.
   */
  invalidate(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Invalidate all entries matching a prefix.
   */
  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    if (count > 0) {
      logger.debug({ prefix, count }, "Cache entries invalidated by prefix");
    }
    return count;
  }

  /**
   * Remove all expired entries.
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        pruned++;
      }
    }
    if (pruned > 0) {
      logger.debug({ pruned }, "Cache pruned expired entries");
    }
    return pruned;
  }

  /**
   * Clear entire cache.
   */
  clear(): void {
    const size = this.store.size;
    this.store.clear();
    logger.debug({ cleared: size }, "Cache cleared");
  }

  /**
   * Get cache statistics.
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.store.size,
      keys: [...this.store.keys()],
    };
  }
}

// Singleton cache instance for the ADO client
let globalCache: ApiCache | null = null;

export function getApiCache(): ApiCache {
  if (!globalCache) {
    globalCache = new ApiCache();
  }
  return globalCache;
}

export function resetApiCache(): void {
  globalCache?.clear();
  globalCache = null;
}

/**
 * Cache key builders for consistent key formatting.
 */
export const CacheKeys = {
  workItem: (id: number) => `wi:${id}`,
  workItemQuery: (queryHash: string) => `wiq:${queryHash}`,
  tsg: (id: string) => `tsg:${id}`,
  tsgList: (category?: string) => `tsg-list:${category ?? "all"}`,
  tsgSearch: (queryHash: string) => `tsg-search:${queryHash}`,
} as const;
