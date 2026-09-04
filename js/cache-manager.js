/**
 * Nexco Edu - Smart Cache Manager Layer (Anti-Read Limit)
 * Mencegah pembacaan berulang ke Firestore dengan konsep Cache-First + Stale-While-Revalidate.
 */

const CacheManager = {
    PREFIX: 'nexco_cache_',
    DEFAULT_TTL_MS: 30 * 60 * 1000, // Default 30 Menit Cache

    get: function (key) {
        try {
            const raw = localStorage.getItem(this.PREFIX + key);
            if (!raw) return null;

            const item = JSON.parse(raw);
            const now = new Date().getTime();

            if (item.expiry && now > item.expiry) {
                localStorage.removeItem(this.PREFIX + key);
                return null;
            }

            return item.data;
        } catch (e) {
            console.warn("Gagal membaca cache lokal key:", key, e);
            return null;
        }
    },

    set: function (key, data, ttlMs = this.DEFAULT_TTL_MS) {
        try {
            const item = {
                data: data,
                timestamp: new Date().getTime(),
                expiry: ttlMs ? new Date().getTime() + ttlMs : null
            };
            localStorage.setItem(this.PREFIX + key, JSON.stringify(item));
        } catch (e) {
            console.warn("Gagal menyimpan cache lokal key:", key, e);
        }
    },

    invalidate: function (key) {
        try {
            if (key) {
                localStorage.removeItem(this.PREFIX + key);
            } else {
                Object.keys(localStorage).forEach(k => {
                    if (k.startsWith(this.PREFIX)) {
                        localStorage.removeItem(k);
                    }
                });
            }
        } catch (e) {
            console.warn("Gagal menghapus cache:", e);
        }
    },

    clearAll: function () {
        this.invalidate(null);
    }
};

window.CacheManager = CacheManager;
