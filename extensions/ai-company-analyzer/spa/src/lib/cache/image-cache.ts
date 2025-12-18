interface CacheEntry<T> {
  data: T;
  sizeBytes: number;
  lastAccessed: number;
}

export class ImageCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private currentSize = 0;
  private maxSize: number;

  constructor(maxSizeBytes: number) {
    this.maxSize = maxSizeBytes;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // LRU: Update last accessed time
    entry.lastAccessed = Date.now();
    return entry.data;
  }

  set(key: string, data: T, sizeBytes: number): void {
    // If key already exists, remove old entry first
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // Evict oldest entries if necessary
    while (this.currentSize + sizeBytes > this.maxSize && this.cache.size > 0) {
      this.evictOldest();
    }

    // Add new entry
    this.cache.set(key, {
      data,
      sizeBytes,
      lastAccessed: Date.now(),
    });
    this.currentSize += sizeBytes;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.currentSize -= entry.sizeBytes;
    return true;
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  getStats() {
    return {
      count: this.cache.size,
      currentSize: this.currentSize,
      maxSize: this.maxSize,
      utilizationPercent: (this.currentSize / this.maxSize) * 100,
    };
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }
}

// Global instances
const MB = 1024 * 1024;
export const imageCache = new ImageCache<any>(50 * MB);
export const thumbnailCache = new ImageCache<any>(20 * MB);
