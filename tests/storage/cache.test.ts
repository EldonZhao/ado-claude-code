import { describe, it, expect, beforeEach } from "vitest";
import { ApiCache, CacheKeys } from "../../src/storage/cache.js";

describe("ApiCache", () => {
  let cache: ApiCache;

  beforeEach(() => {
    cache = new ApiCache(1000); // 1 second TTL for tests
  });

  describe("get/set", () => {
    it("returns undefined for missing key", () => {
      expect(cache.get("missing")).toBeUndefined();
    });

    it("stores and retrieves values", () => {
      cache.set("key1", { name: "test" });
      expect(cache.get("key1")).toEqual({ name: "test" });
    });

    it("returns undefined for expired entries", async () => {
      cache.set("key1", "value", 10); // 10ms TTL
      await new Promise((r) => setTimeout(r, 20));
      expect(cache.get("key1")).toBeUndefined();
    });
  });

  describe("getOrCompute", () => {
    it("calls factory and caches result", async () => {
      let callCount = 0;
      const factory = async () => {
        callCount++;
        return "computed";
      };

      const result1 = await cache.getOrCompute("key", factory);
      const result2 = await cache.getOrCompute("key", factory);

      expect(result1).toBe("computed");
      expect(result2).toBe("computed");
      expect(callCount).toBe(1);
    });

    it("recomputes after expiry", async () => {
      let callCount = 0;
      const factory = async () => {
        callCount++;
        return `v${callCount}`;
      };

      const result1 = await cache.getOrCompute("key", factory, 10);
      expect(result1).toBe("v1");

      await new Promise((r) => setTimeout(r, 20));
      const result2 = await cache.getOrCompute("key", factory, 10);
      expect(result2).toBe("v2");
      expect(callCount).toBe(2);
    });
  });

  describe("invalidate", () => {
    it("removes a specific entry", () => {
      cache.set("a", 1);
      cache.set("b", 2);

      expect(cache.invalidate("a")).toBe(true);
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBe(2);
    });

    it("returns false for missing key", () => {
      expect(cache.invalidate("missing")).toBe(false);
    });
  });

  describe("invalidateByPrefix", () => {
    it("removes entries matching prefix", () => {
      cache.set("wi:100", "a");
      cache.set("wi:200", "b");
      cache.set("tsg:1", "c");

      const count = cache.invalidateByPrefix("wi:");
      expect(count).toBe(2);
      expect(cache.get("wi:100")).toBeUndefined();
      expect(cache.get("wi:200")).toBeUndefined();
      expect(cache.get("tsg:1")).toBe("c");
    });
  });

  describe("prune", () => {
    it("removes expired entries", async () => {
      cache.set("fast", "value", 10);
      cache.set("slow", "value", 10000);

      await new Promise((r) => setTimeout(r, 20));
      const pruned = cache.prune();

      expect(pruned).toBe(1);
      expect(cache.get("fast")).toBeUndefined();
      expect(cache.get("slow")).toBe("value");
    });
  });

  describe("clear", () => {
    it("removes all entries", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.clear();
      expect(cache.stats().size).toBe(0);
    });
  });

  describe("stats", () => {
    it("returns size and keys", () => {
      cache.set("x", 1);
      cache.set("y", 2);
      const stats = cache.stats();
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain("x");
      expect(stats.keys).toContain("y");
    });
  });
});

describe("CacheKeys", () => {
  it("generates work item key", () => {
    expect(CacheKeys.workItem(123)).toBe("wi:123");
  });

  it("generates query key", () => {
    expect(CacheKeys.workItemQuery("abc")).toBe("wiq:abc");
  });

  it("generates tsg key", () => {
    expect(CacheKeys.tsg("tsg-001")).toBe("tsg:tsg-001");
  });

  it("generates tsg list key with category", () => {
    expect(CacheKeys.tsgList("deploy")).toBe("tsg-list:deploy");
  });

  it("generates tsg list key without category", () => {
    expect(CacheKeys.tsgList()).toBe("tsg-list:all");
  });

  it("generates tsg search key", () => {
    expect(CacheKeys.tsgSearch("hash123")).toBe("tsg-search:hash123");
  });
});
