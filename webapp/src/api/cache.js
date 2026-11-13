// Tiny TTL cache with in-flight de-duplication.
// Keeps us inside Yahoo's tolerance and makes repeated tab loads instant.
export class TtlCache {
    ttlMs;
    maxEntries;
    store = new Map();
    inflight = new Map();
    constructor(ttlMs, maxEntries = 500) {
        this.ttlMs = ttlMs;
        this.maxEntries = maxEntries;
    }
    get(key) {
        const hit = this.store.get(key);
        if (!hit)
            return undefined;
        if (hit.expires < Date.now()) {
            this.store.delete(key);
            return undefined;
        }
        return hit.value;
    }
    set(key, value) {
        if (this.store.size >= this.maxEntries) {
            const oldest = this.store.keys().next().value;
            if (oldest !== undefined)
                this.store.delete(oldest);
        }
        this.store.set(key, { value, expires: Date.now() + this.ttlMs });
        return value;
    }
    /** Read-through: concurrent callers share one producer. */
    async wrap(key, produce) {
        const hit = this.get(key);
        if (hit !== undefined)
            return hit;
        const pending = this.inflight.get(key);
        if (pending)
            return pending;
        const promise = produce()
            .then((value) => {
            this.set(key, value);
            return value;
        })
            .finally(() => this.inflight.delete(key));
        this.inflight.set(key, promise);
        return promise;
    }
    clear() {
        this.store.clear();
        this.inflight.clear();
    }
    get size() {
        return this.store.size;
    }
}
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
