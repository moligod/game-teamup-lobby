class ExpiringStore {
    constructor(options = {}) {
        this.clock = options.clock || (() => Date.now());
        this.maxEntries = options.maxEntries === Infinity
            ? Infinity
            : Math.max(1, Number(options.maxEntries || 10000));
        this.values = new Map();
        this.inFlight = new Map();
        this.generation = 0;
    }

    set(key, value, ttlMs) {
        this.values.delete(key);
        this.pruneExpired();
        while (this.values.size >= this.maxEntries) {
            const oldestKey = this.values.keys().next().value;
            if (oldestKey === undefined) break;
            this.values.delete(oldestKey);
        }
        this.values.set(key, {
            value,
            expiresAt: this.clock() + ttlMs
        });
        return value;
    }

    get(key) {
        const entry = this.values.get(key);
        if (!entry) return null;
        if (entry.expiresAt < this.clock()) {
            this.values.delete(key);
            return null;
        }
        this.values.delete(key);
        this.values.set(key, entry);
        return entry.value;
    }

    getOrLoad(key, loader, ttlMs) {
        const cached = this.get(key);
        if (cached !== null) return Promise.resolve(cached);

        const activeLoad = this.inFlight.get(key);
        if (activeLoad) return activeLoad;

        const generation = this.generation;
        const pending = Promise.resolve()
            .then(loader)
            .then((value) => {
                if (this.generation === generation) {
                    this.set(key, value, ttlMs);
                }
                return value;
            })
            .finally(() => {
                if (this.inFlight.get(key) === pending) {
                    this.inFlight.delete(key);
                }
            });
        this.inFlight.set(key, pending);
        return pending;
    }

    consume(key) {
        const value = this.get(key);
        this.values.delete(key);
        return value;
    }

    touch(key, ttlMs) {
        const value = this.get(key);
        if (value === null) return null;
        this.set(key, value, ttlMs);
        return value;
    }

    delete(key) {
        return this.values.delete(key);
    }

    clear() {
        this.generation += 1;
        this.values.clear();
        this.inFlight.clear();
    }

    pruneExpired() {
        const now = this.clock();
        for (const [key, entry] of this.values) {
            if (entry.expiresAt < now) {
                this.values.delete(key);
            }
        }
    }

    get size() {
        this.pruneExpired();
        return this.values.size;
    }
}

module.exports = { ExpiringStore };
