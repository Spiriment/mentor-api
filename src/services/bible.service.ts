import axios from 'axios';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class BibleService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxEntries: number;
  private defaultTtlMs: number;

  constructor(options?: { maxEntries?: number; defaultTtlMs?: number }) {
    this.maxEntries = options?.maxEntries ?? 1000;
    this.defaultTtlMs = options?.defaultTtlMs ?? 24 * 60 * 60 * 1000; // 24h
  }

  private getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  private setCache<T>(key: string, value: T, ttlMs?: number) {
    if (this.cache.size >= this.maxEntries) {
      // simple LRU-ish eviction: delete first inserted key
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  // Fetch a chapter (e.g., book="John", chapter=3)
  async getChapter(book: string, chapter: number) {
    const key = `chapter:${book}:${chapter}`;
    const cached = this.getCache<any>(key);
    if (cached) return cached;

    const url = `https://bible-api.com/${encodeURIComponent(book)}+${chapter}`;
    const { data } = await axios.get(url);
    this.setCache(key, data, this.defaultTtlMs);
    return data;
  }

  // Fetch a passage by reference string (e.g., "John 3:16-18")
  async getPassage(reference: string) {
    const key = `passage:${reference}`;
    const cached = this.getCache<any>(key);
    if (cached) return cached;

    const url = `https://bible-api.com/${encodeURIComponent(reference)}`;
    const { data } = await axios.get(url);
    // shorter TTL for smaller lookups
    this.setCache(key, data, 60 * 60 * 1000); // 1h
    return data;
  }
}
