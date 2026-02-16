const fs = require('fs');
const path = require('path');

const DAY_MS = 24 * 60 * 60 * 1000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'premium-db.json');

const DEFAULT_DB = {
    version: 1,
    updatedAt: null,
    users: {},
    codes: {},
    redemptions: []
};

function nowIso() {
    return new Date().toISOString();
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function normalizeCode(code) {
    return String(code || '').trim().toUpperCase();
}

function toNumber(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function parseDateMs(value) {
    if (!value) return null;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
}

function parseAdminEmails() {
    return String(process.env.PREMIUM_ADMIN_EMAILS || '')
        .split(',')
        .map((item) => normalizeEmail(item))
        .filter(Boolean);
}

function isAdminEmail(email) {
    const admins = parseAdminEmails();
    return admins.includes(normalizeEmail(email));
}

function buildPremiumSnapshot(record) {
    if (!record || !record.premiumUntil) {
        return {
            premium: false,
            premiumUntil: null,
            daysRemaining: 0
        };
    }

    const nowMs = Date.now();
    const untilMs = parseDateMs(record.premiumUntil);
    if (!untilMs || untilMs <= nowMs) {
        return {
            premium: false,
            premiumUntil: record.premiumUntil || null,
            daysRemaining: 0
        };
    }

    const daysRemaining = Math.ceil((untilMs - nowMs) / DAY_MS);
    return {
        premium: true,
        premiumUntil: new Date(untilMs).toISOString(),
        daysRemaining
    };
}

async function ensureDbFile() {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });

    try {
        await fs.promises.access(DB_FILE, fs.constants.F_OK);
    } catch {
        const db = {
            ...DEFAULT_DB,
            updatedAt: nowIso(),
            codes: {
                'AYLIK-TEST-30': {
                    label: 'Aylik test kodu',
                    durationDays: 30,
                    maxUses: 0,
                    singleUsePerEmail: false,
                    reuseCooldownDays: 28,
                    usedCount: 0,
                    usedByEmails: [],
                    active: true,
                    createdAt: nowIso()
                }
            }
        };
        await fs.promises.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    }
}

function sanitizeDb(db) {
    return {
        ...DEFAULT_DB,
        ...db,
        users: db?.users || {},
        codes: db?.codes || {},
        redemptions: Array.isArray(db?.redemptions) ? db.redemptions : []
    };
}

function applyEnvCodes(db) {
    // Format:
    // PREMIUM_CODES=KOD1|30|0|28,KOD2|30|100|0
    // fields: code|durationDays|maxUses|reuseCooldownDays
    const raw = String(process.env.PREMIUM_CODES || '').trim();
    if (!raw) return;

    const entries = raw.split(',').map((item) => item.trim()).filter(Boolean);
    for (const entry of entries) {
        const [rawCode, rawDuration, rawMaxUses, rawCooldown] = entry.split('|');
        const code = normalizeCode(rawCode);
        if (!code) continue;

        const durationDays = Math.max(1, Math.floor(toNumber(rawDuration, 30)));
        const maxUses = Math.max(0, Math.floor(toNumber(rawMaxUses, 0)));
        const reuseCooldownDays = Math.max(0, Math.floor(toNumber(rawCooldown, 28)));

        if (!db.codes[code]) {
            db.codes[code] = {
                label: `Env code ${code}`,
                durationDays,
                maxUses,
                singleUsePerEmail: false,
                reuseCooldownDays,
                usedCount: 0,
                usedByEmails: [],
                active: true,
                createdAt: nowIso()
            };
        }
    }
}

async function readDb() {
    await ensureDbFile();
    const raw = await fs.promises.readFile(DB_FILE, 'utf8');
    const parsed = sanitizeDb(JSON.parse(raw));
    applyEnvCodes(parsed);
    return parsed;
}

async function writeDb(db) {
    db.updatedAt = nowIso();
    const tmpPath = `${DB_FILE}.tmp`;
    await fs.promises.writeFile(tmpPath, JSON.stringify(db, null, 2), 'utf8');
    await fs.promises.rename(tmpPath, DB_FILE);
}

async function verifyFirebaseToken(idToken) {
    const apiKey = String(process.env.FIREBASE_WEB_API_KEY || process.env.FIREBASE_API_KEY || '').trim();
    if (!apiKey || !idToken) {
        return null;
    }

    try {
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        const account = data?.users?.[0];
        const email = normalizeEmail(account?.email);
        if (!email) {
            return null;
        }

        return {
            uid: String(account.localId || '').trim(),
            email,
            trusted: true
        };
    } catch {
        return null;
    }
}

async function resolveRequestUser(req) {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    const verified = await verifyFirebaseToken(token);
    if (verified) {
        return verified;
    }

    const email = normalizeEmail(req.headers['x-user-email']);
    const uid = String(req.headers['x-user-uid'] || '').trim();
    if (!email) return null;

    return {
        uid: uid || email,
        email,
        trusted: false
    };
}

function upsertUserRecord(db, email) {
    if (!db.users[email]) {
        db.users[email] = {
            email,
            premiumUntil: null,
            lastActivationCode: null,
            activationHistory: [],
            updatedAt: nowIso(),
            createdAt: nowIso()
        };
    }

    if (!Array.isArray(db.users[email].activationHistory)) {
        db.users[email].activationHistory = [];
    }

    return db.users[email];
}

function canRedeemByCooldown(record, code, cooldownDays) {
    if (!record || !Array.isArray(record.activationHistory) || cooldownDays <= 0) {
        return { ok: true };
    }

    const nowMs = Date.now();
    const latestByCode = [...record.activationHistory]
        .reverse()
        .find((entry) => normalizeCode(entry.code) === code);

    if (!latestByCode) {
        return { ok: true };
    }

    const lastMs = parseDateMs(latestByCode.redeemedAt);
    if (!lastMs) {
        return { ok: true };
    }

    const diffDays = (nowMs - lastMs) / DAY_MS;
    if (diffDays >= cooldownDays) {
        return { ok: true };
    }

    return {
        ok: false,
        retryInDays: Math.ceil(cooldownDays - diffDays)
    };
}

async function registerPremiumRoutes(app) {
    app.get('/api/premium/me', async (req, res) => {
        try {
            const user = await resolveRequestUser(req);
            if (!user) {
                return res.status(401).json({ ok: false, error: 'Unauthorized' });
            }

            const db = await readDb();
            const record = db.users[user.email] || null;
            const snapshot = buildPremiumSnapshot(record);

            return res.json({
                ok: true,
                email: user.email,
                trustedAuth: user.trusted,
                isAdmin: isAdminEmail(user.email),
                ...snapshot
            });
        } catch (error) {
            console.error('[Premium] /me failed:', error);
            return res.status(500).json({ ok: false, error: 'Internal error' });
        }
    });

    app.post('/api/premium/redeem', async (req, res) => {
        try {
            const user = await resolveRequestUser(req);
            if (!user) {
                return res.status(401).json({ ok: false, error: 'Unauthorized' });
            }

            const code = normalizeCode(req.body?.code);
            if (!code) {
                return res.status(400).json({ ok: false, error: 'Activation code is required' });
            }

            const db = await readDb();
            const codeRecord = db.codes[code];
            if (!codeRecord || codeRecord.active === false) {
                return res.status(404).json({ ok: false, error: 'Activation code not found or inactive' });
            }

            const nowMs = Date.now();
            const expiresMs = parseDateMs(codeRecord.expiresAt);
            if (expiresMs && expiresMs <= nowMs) {
                return res.status(400).json({ ok: false, error: 'Activation code expired' });
            }

            const maxUses = Math.max(0, Math.floor(toNumber(codeRecord.maxUses, 0)));
            const usedCount = Math.max(0, Math.floor(toNumber(codeRecord.usedCount, 0)));
            if (maxUses > 0 && usedCount >= maxUses) {
                return res.status(400).json({ ok: false, error: 'Activation code usage limit reached' });
            }

            const userRecord = upsertUserRecord(db, user.email);
            const singleUsePerEmail = codeRecord.singleUsePerEmail !== false;
            const usedByEmails = Array.isArray(codeRecord.usedByEmails) ? codeRecord.usedByEmails : [];
            if (singleUsePerEmail && usedByEmails.includes(user.email)) {
                return res.status(400).json({ ok: false, error: 'You already used this activation code' });
            }

            const cooldownDays = Math.max(0, Math.floor(toNumber(codeRecord.reuseCooldownDays, 28)));
            const cooldownCheck = canRedeemByCooldown(userRecord, code, cooldownDays);
            if (!cooldownCheck.ok) {
                return res.status(400).json({
                    ok: false,
                    error: `This code can be used again in ${cooldownCheck.retryInDays} day(s)`
                });
            }

            const durationDays = Math.max(1, Math.floor(toNumber(codeRecord.durationDays, 30)));
            const currentPremiumUntilMs = parseDateMs(userRecord.premiumUntil) || 0;
            const baseMs = Math.max(nowMs, currentPremiumUntilMs);
            const newPremiumUntilMs = baseMs + (durationDays * DAY_MS);
            const redeemedAt = nowIso();

            userRecord.premiumUntil = new Date(newPremiumUntilMs).toISOString();
            userRecord.lastActivationCode = code;
            userRecord.updatedAt = redeemedAt;
            userRecord.activationHistory.push({
                code,
                durationDays,
                redeemedAt
            });
            if (userRecord.activationHistory.length > 100) {
                userRecord.activationHistory = userRecord.activationHistory.slice(-100);
            }

            codeRecord.usedCount = usedCount + 1;
            if (!usedByEmails.includes(user.email)) {
                usedByEmails.push(user.email);
            }
            codeRecord.usedByEmails = usedByEmails;
            codeRecord.lastUsedAt = redeemedAt;

            db.redemptions.push({
                email: user.email,
                code,
                durationDays,
                redeemedAt,
                trustedAuth: user.trusted
            });
            if (db.redemptions.length > 1000) {
                db.redemptions = db.redemptions.slice(-1000);
            }

            await writeDb(db);

            const snapshot = buildPremiumSnapshot(userRecord);
            return res.json({
                ok: true,
                message: `${durationDays} day premium activated`,
                email: user.email,
                ...snapshot
            });
        } catch (error) {
            console.error('[Premium] /redeem failed:', error);
            return res.status(500).json({ ok: false, error: 'Internal error' });
        }
    });

    app.get('/api/premium/accounts', async (req, res) => {
        try {
            const user = await resolveRequestUser(req);
            if (!user) {
                return res.status(401).json({ ok: false, error: 'Unauthorized' });
            }

            if (!isAdminEmail(user.email)) {
                return res.status(403).json({ ok: false, error: 'Forbidden' });
            }

            const db = await readDb();
            const accounts = Object.values(db.users).map((record) => {
                const snapshot = buildPremiumSnapshot(record);
                return {
                    email: record.email,
                    premium: snapshot.premium,
                    premiumUntil: snapshot.premiumUntil,
                    daysRemaining: snapshot.daysRemaining,
                    lastActivationCode: record.lastActivationCode || null,
                    updatedAt: record.updatedAt || null
                };
            }).sort((a, b) => {
                if (a.premium === b.premium) {
                    return String(a.email).localeCompare(String(b.email));
                }
                return a.premium ? -1 : 1;
            });

            return res.json({
                ok: true,
                total: accounts.length,
                accounts
            });
        } catch (error) {
            console.error('[Premium] /accounts failed:', error);
            return res.status(500).json({ ok: false, error: 'Internal error' });
        }
    });
}

module.exports = {
    registerPremiumRoutes
};
