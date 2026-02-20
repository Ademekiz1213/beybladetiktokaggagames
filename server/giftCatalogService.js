const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const CATALOG_FILE = path.join(DATA_DIR, 'gift-catalog.json');

const DEFAULT_GIFT_NAMES = [
    'Balloon',
    'Cap',
    'Doughnut',
    'Finger Heart',
    'Flying Kiss',
    'Freestyle',
    'GG',
    'Galaksi',
    'Galaxy',
    'Hand Heart',
    'Hat',
    'Heart',
    'Hearts',
    'Heart Me',
    'Ice Cream',
    'Ice Cream Cone',
    'Love You',
    'Money Gun',
    'Nazar Boncugu',
    'Perfume',
    'Popular',
    'Rosa',
    'Rose',
    'Tea',
    'TikTok',
    'Turkish coffee',
    'Drama Queen',
    'Universe',
    'Swan',
    'Castle',
    'Sports Car',
    'Diamond',
    'Treasure Box',
    'Lion',
    'Fireworks'
];

function nowIso() {
    return new Date().toISOString();
}

function normalizeGiftName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ');
}

function normalizeGiftKey(name) {
    return normalizeGiftName(name).toLowerCase();
}

function normalizeGiftId(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    return Math.floor(num);
}

function normalizeImageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (!/^https?:\/\//i.test(raw)) return '';
    return raw;
}

function toPublicGift(entry) {
    return {
        giftId: normalizeGiftId(entry?.giftId),
        giftName: normalizeGiftName(entry?.giftName),
        imageUrl: normalizeImageUrl(entry?.imageUrl)
    };
}

function sanitizeCatalog(raw) {
    const catalog = {
        version: 1,
        updatedAt: null,
        gifts: []
    };

    if (!raw || typeof raw !== 'object') {
        return catalog;
    }

    const sourceList = Array.isArray(raw.gifts) ? raw.gifts : [];
    for (const item of sourceList) {
        const giftName = normalizeGiftName(item?.giftName || item?.name);
        if (!giftName) continue;

        const key = normalizeGiftKey(giftName);
        const existing = catalog.gifts.find((gift) => normalizeGiftKey(gift.giftName) === key);
        const nextImageUrl = normalizeImageUrl(item?.imageUrl || item?.giftPictureUrl);
        const nextGiftId = normalizeGiftId(item?.giftId ?? item?.id);

        if (!existing) {
            catalog.gifts.push({
                giftId: nextGiftId,
                giftName,
                imageUrl: nextImageUrl,
                createdAt: item?.createdAt || null,
                updatedAt: item?.updatedAt || null
            });
            continue;
        }

        if (nextGiftId && !existing.giftId) existing.giftId = nextGiftId;
        if (nextImageUrl && !existing.imageUrl) existing.imageUrl = nextImageUrl;
    }

    catalog.updatedAt = raw.updatedAt || null;
    return catalog;
}

class GiftCatalogService {
    constructor(options = {}) {
        this.catalogFile = options.catalogFile || CATALOG_FILE;
        this.catalog = sanitizeCatalog(null);
        this._persistTimer = null;
        this._writePromise = null;
        this._dirty = false;
    }

    async init() {
        await fs.promises.mkdir(path.dirname(this.catalogFile), { recursive: true });

        try {
            const raw = await fs.promises.readFile(this.catalogFile, 'utf8');
            this.catalog = sanitizeCatalog(JSON.parse(raw));
        } catch (error) {
            if (error?.code !== 'ENOENT') {
                console.error('[GiftCatalog] Failed to read catalog file:', error);
            }
            this.catalog = sanitizeCatalog(null);
        }

        const seeded = this.registerKnownGiftNames(DEFAULT_GIFT_NAMES);
        if (!this.catalog.updatedAt) {
            this.catalog.updatedAt = nowIso();
            this._dirty = true;
        }

        if (seeded || this._dirty) {
            await this._flushPersist();
        }
    }

    registerKnownGiftNames(names = []) {
        let changed = false;

        for (const rawName of names) {
            const giftName = normalizeGiftName(rawName);
            if (!giftName) continue;

            const key = normalizeGiftKey(giftName);
            const existing = this.catalog.gifts.find((gift) => normalizeGiftKey(gift.giftName) === key);
            if (existing) continue;

            this.catalog.gifts.push({
                giftId: null,
                giftName,
                imageUrl: '',
                createdAt: nowIso(),
                updatedAt: nowIso()
            });
            changed = true;
        }

        if (changed) {
            this.catalog.updatedAt = nowIso();
            this._dirty = true;
            this._schedulePersist();
        }

        return changed;
    }

    getSnapshot() {
        const gifts = this.catalog.gifts
            .map((gift) => toPublicGift(gift))
            .filter((gift) => gift.giftName)
            .sort((a, b) => a.giftName.localeCompare(b.giftName, 'tr', { sensitivity: 'base' }));

        return {
            version: 1,
            updatedAt: this.catalog.updatedAt || null,
            gifts
        };
    }

    upsertFromGiftEvent(eventData) {
        const giftName = normalizeGiftName(eventData?.giftName);
        if (!giftName) {
            return { changed: false, entry: null, updatedAt: this.catalog.updatedAt || null };
        }

        const key = normalizeGiftKey(giftName);
        const giftId = normalizeGiftId(eventData?.giftId);
        const imageUrl = normalizeImageUrl(eventData?.giftPictureUrl || eventData?.imageUrl);

        let entry = null;
        if (giftId) {
            entry = this.catalog.gifts.find((gift) => normalizeGiftId(gift.giftId) === giftId) || null;
        }
        if (!entry) {
            entry = this.catalog.gifts.find((gift) => normalizeGiftKey(gift.giftName) === key) || null;
        }

        let changed = false;
        if (!entry) {
            entry = {
                giftId: giftId || null,
                giftName,
                imageUrl: imageUrl || '',
                createdAt: nowIso(),
                updatedAt: nowIso()
            };
            this.catalog.gifts.push(entry);
            changed = true;
        } else {
            if (giftId && entry.giftId !== giftId) {
                entry.giftId = giftId;
                changed = true;
            }

            if (entry.giftName !== giftName) {
                entry.giftName = giftName;
                changed = true;
            }

            if (imageUrl && entry.imageUrl !== imageUrl) {
                entry.imageUrl = imageUrl;
                changed = true;
            }
        }

        if (changed) {
            entry.updatedAt = nowIso();
            this.catalog.updatedAt = entry.updatedAt;
            this._dirty = true;
            this._schedulePersist();
        }

        return {
            changed,
            entry: toPublicGift(entry),
            updatedAt: this.catalog.updatedAt || null
        };
    }

    _schedulePersist() {
        if (this._persistTimer) return;
        this._persistTimer = setTimeout(() => {
            this._persistTimer = null;
            this._flushPersist().catch((error) => {
                console.error('[GiftCatalog] Failed to persist catalog:', error);
            });
        }, 350);
    }

    async _flushPersist() {
        if (!this._dirty) return;

        if (this._writePromise) {
            await this._writePromise;
            return;
        }

        const payload = JSON.stringify(this.catalog, null, 2);
        const tmpFile = `${this.catalogFile}.tmp`;
        this._dirty = false;

        this._writePromise = fs.promises.writeFile(tmpFile, payload, 'utf8')
            .then(() => fs.promises.rename(tmpFile, this.catalogFile))
            .catch((error) => {
                this._dirty = true;
                throw error;
            })
            .finally(() => {
                this._writePromise = null;
                if (this._dirty && !this._persistTimer) {
                    this._schedulePersist();
                }
            });

        await this._writePromise;
    }
}

module.exports = {
    GiftCatalogService,
    DEFAULT_GIFT_NAMES
};

