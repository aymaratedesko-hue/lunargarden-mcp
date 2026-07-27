// src/lib/cache.js - Cache helpers with Cloudflare KV primary + in-memory fallback.
//
// Public API:
//   - getCache(env) -> { get(key), put(key, value, ttlSeconds), delete(key) }
//
// Behavior:
//   - If env.CACHE (KV namespace) is present, use it.
//   - Otherwise, fall back to a per-isolate Map with TTL eviction.
//   - Failures from KV never crash the caller; they fall back to memory.
//   - Memory cache is for local development and is process-local; it WILL NOT
//     persist across isolate restarts or across regions.

const MEMORY_TTL_PAD_SECONDS = 5;

function memoryBackend() {
  const map = new Map();
  return {
    async get(key) {
      const entry = map.get(key);
      if (!entry) return null;
      if (entry.expiresAtMs && entry.expiresAtMs < Date.now()) {
        map.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(key, value, ttlSeconds) {
      const ttl = Math.max(1, Math.floor(ttlSeconds || 60));
      map.set(key, { value, expiresAtMs: Date.now() + ttl * 1000 });
    },
    async delete(key) {
      map.delete(key);
    },
  };
}

function kvBackend(kv) {
  return {
    async get(key) {
      try {
        const v = await kv.get(key);
        if (!v) return null;
        return JSON.parse(v);
      } catch (_e) {
        return null;
      }
    },
    async put(key, value, ttlSeconds) {
      try {
        const ttl = Math.max(60, Math.floor(ttlSeconds || 60) + MEMORY_TTL_PAD_SECONDS);
        await kv.put(key, JSON.stringify(value), { expirationTtl: ttl });
      } catch (_e) {
        // best-effort; cache failure is non-fatal
      }
    },
    async delete(key) {
      try { await kv.delete(key); } catch (_e) { /* ignore */ }
    },
  };
}

export function getCache(env) {
  if (env && env.CACHE && typeof env.CACHE.get === "function") {
    return kvBackend(env.CACHE);
  }
  return memoryBackend();
}

// Stable JSON-string cache key. Keeps order-independent for object keys.
export function cacheKey(parts) {
  return JSON.stringify(parts, Object.keys(parts || {}).sort());
}