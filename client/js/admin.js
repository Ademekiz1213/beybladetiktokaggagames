import { logoutCurrentUser, waitForUser } from './firebase-auth.js';

function toIsoFromInput(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function toInputDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setMessage(message, type = 'info') {
    const messageEl = document.getElementById('adminMessage');
    if (!messageEl) return;

    if (!message) {
        messageEl.style.display = 'none';
        messageEl.textContent = '';
        messageEl.classList.remove('is-success', 'is-error', 'is-info');
        return;
    }

    messageEl.style.display = 'block';
    messageEl.textContent = message;
    messageEl.classList.remove('is-success', 'is-error', 'is-info');
    messageEl.classList.add(`is-${type}`);
}

async function buildAuthHeaders(user, includeJson = false) {
    const headers = {};
    if (includeJson) {
        headers['Content-Type'] = 'application/json';
    }

    if (user?.email) {
        headers['x-user-email'] = user.email;
    }
    if (user?.uid) {
        headers['x-user-uid'] = user.uid;
    }

    try {
        const token = await user.getIdToken(false);
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
    } catch (error) {
        console.warn('[Admin] Could not load Firebase token:', error);
    }

    return headers;
}

async function fetchApi(url, { method = 'GET', user, body } = {}) {
    const response = await fetch(url, {
        method,
        headers: await buildAuthHeaders(user, Boolean(body)),
        body: body ? JSON.stringify(body) : undefined
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `Request failed (${response.status})`);
    }

    return payload;
}

function renderCodes(codes) {
    const list = document.getElementById('codesList');
    if (!list) return;

    if (!Array.isArray(codes) || codes.length === 0) {
        list.innerHTML = '<div class="admin-list-empty">Kod yok</div>';
        return;
    }

    list.innerHTML = codes.map((code) => {
        const statusClass = code.active && !code.expired ? 'is-on' : 'is-off';
        const statusLabel = code.active && !code.expired ? 'Aktif' : 'Pasif';
        const usageLabel = code.maxUses > 0 ? `${code.usedCount}/${code.maxUses}` : `${code.usedCount}/limitsiz`;

        return `
            <div class="admin-item" data-code="${code.code}">
                <div class="admin-item-main">
                    <strong>${code.code}</strong>
                    <span>${code.label || '-'}</span>
                </div>
                <div class="admin-item-meta">
                    <span class="dashboard-badge ${statusClass}">${statusLabel}</span>
                    <span>Sure: ${code.durationDays} gun</span>
                    <span>Kullanim: ${usageLabel}</span>
                    <span>Bitis: ${formatDate(code.expiresAt)}</span>
                </div>
                <button type="button" class="btn btn-secondary btn-small code-edit-btn" data-code="${code.code}">Duzenle</button>
            </div>
        `;
    }).join('');
}

function renderAccounts(accounts) {
    const list = document.getElementById('accountsList');
    if (!list) return;

    if (!Array.isArray(accounts) || accounts.length === 0) {
        list.innerHTML = '<div class="admin-list-empty">Hesap yok</div>';
        return;
    }

    list.innerHTML = accounts.map((account) => {
        const statusClass = account.premium ? 'is-on' : 'is-off';
        const statusLabel = account.premium ? 'Premium' : 'Standart';
        return `
            <div class="admin-item">
                <div class="admin-item-main">
                    <strong>${account.email}</strong>
                    <span>Son Kod: ${account.lastActivationCode || '-'}</span>
                </div>
                <div class="admin-item-meta">
                    <span class="dashboard-badge ${statusClass}">${statusLabel}</span>
                    <span>Bitis: ${formatDate(account.premiumUntil)}</span>
                    <span>Kalan: ${account.daysRemaining || 0} gun</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderLiveConnections(payload) {
    const summaryEl = document.getElementById('liveConnectionsSummary');
    const list = document.getElementById('liveConnectionsList');
    if (!summaryEl || !list) return;

    const totalSockets = Number(payload?.totalSockets || 0);
    const totalConnectedStreamers = Number(payload?.totalConnectedStreamers || 0);
    summaryEl.textContent = `${totalSockets} sekme aktif, ${totalConnectedStreamers} farkli yayinci canli bagli.`;

    const sockets = Array.isArray(payload?.sockets) ? payload.sockets : [];
    if (sockets.length === 0) {
        list.innerHTML = '<div class="admin-list-empty">Aktif bagli yayinci yok</div>';
        return;
    }

    list.innerHTML = sockets.map((entry) => {
        const connected = Array.isArray(entry.connectedUsernames) ? entry.connectedUsernames : [];
        const tracked = Array.isArray(entry.trackedUsernames) ? entry.trackedUsernames : [];
        const trackedOnly = tracked.filter((username) => !connected.includes(username));

        const connectedChips = connected.length > 0
            ? connected.map((username) => `<span class="live-chip">${escapeHtml(username)}</span>`).join('')
            : '<span class="admin-list-empty">Canli bagli yok</span>';

        const trackedChips = trackedOnly.length > 0
            ? trackedOnly.map((username) => `<span class="live-chip">${escapeHtml(username)} (beklemede)</span>`).join('')
            : '';

        return `
            <div class="admin-item">
                <div class="admin-item-main">
                    <strong>${escapeHtml(entry.userEmail || 'Bilinmeyen hesap')}</strong>
                    <span>Socket: ${escapeHtml(entry.socketId || '-')}</span>
                </div>
                <div class="admin-item-meta">
                    <span>Canli: ${Number(entry.connectedCount || connected.length)}</span>
                    <span>Takipte: ${Number(entry.trackedCount || tracked.length)}</span>
                    <span>Guncelleme: ${formatDate(entry.updatedAt)}</span>
                </div>
                <div class="live-streamer-chips">${connectedChips}</div>
                ${trackedChips ? `<div class="live-streamer-chips">${trackedChips}</div>` : ''}
            </div>
        `;
    }).join('');
}

function setAdminReadonlyState(readonly) {
    const selector = [
        '#refreshCodesBtn',
        '#refreshAccountsBtn',
        '#refreshLiveConnectionsBtn',
        '#saveCodeBtn',
        '#grantBtn',
        '#revokeBtn',
        '#sendAnnouncementBtn',
        '#saveAnnouncementNameBtn',
        '#codeForm input',
        '#grantForm input',
        '#announceDisplayName',
        '#announceForm textarea'
    ].join(', ');

    document.querySelectorAll(selector).forEach((element) => {
        element.disabled = readonly;
    });
}

function fillCodeForm(code) {
    document.getElementById('codeValue').value = code.code || '';
    document.getElementById('codeLabel').value = code.label || '';
    document.getElementById('codeDurationDays').value = String(code.durationDays || 30);
    document.getElementById('codeMaxUses').value = String(code.maxUses || 0);
    document.getElementById('codeCooldownDays').value = String(code.reuseCooldownDays || 28);
    document.getElementById('codeSingleUse').checked = code.singleUsePerEmail !== false;
    document.getElementById('codeActive').checked = code.active !== false;
    document.getElementById('codeExpiresAt').value = toInputDateTime(code.expiresAt);
}

async function initAdminPage() {
    const user = await waitForUser();
    if (!user) {
        window.location.replace('/login.html');
        return;
    }

    const adminEmail = document.getElementById('adminEmail');
    if (adminEmail) {
        adminEmail.textContent = user.email || '-';
    }

    const logoutBtn = document.getElementById('adminLogoutBtn');
    logoutBtn?.addEventListener('click', async () => {
        logoutBtn.disabled = true;
        logoutBtn.textContent = 'Cikis yapiliyor...';
        try {
            await logoutCurrentUser();
            window.location.replace('/login.html');
        } catch (error) {
            setMessage(error.message || 'Cikis yapilamadi.', 'error');
            logoutBtn.disabled = false;
            logoutBtn.textContent = 'Cikis Yap';
        }
    });

    const mePayload = await fetchApi('/api/premium/me', { user });
    if (!mePayload.isAdmin) {
        setAdminReadonlyState(true);
        renderCodes([]);
        renderAccounts([]);
        renderLiveConnections({
            totalSockets: 0,
            totalConnectedStreamers: 0,
            sockets: []
        });

        const activeEmail = user.email || mePayload.email || '-';
        const adminConfigCount = Number(mePayload.adminConfigCount || 0);
        setMessage(
            `Bu hesap admin degil. Giris yapan: ${activeEmail}. Tanimli admin sayisi: ${adminConfigCount}. PM2 env icindeki PREMIUM_ADMIN_EMAILS degerini kontrol edip "pm2 restart ecosystem.config.cjs --only beyblade --update-env" komutunu calistirin.`,
            'error'
        );
        return;
    }

    let cachedCodes = [];
    let liveRefreshTimer = null;

    async function refreshCodes() {
        const payload = await fetchApi('/api/premium/codes', { user });
        cachedCodes = payload.codes || [];
        renderCodes(cachedCodes);
    }

    async function refreshAccounts() {
        const payload = await fetchApi('/api/premium/accounts', { user });
        renderAccounts(payload.accounts || []);
    }

    async function refreshLiveConnections() {
        const payload = await fetchApi('/api/admin/live-streamers', { user });
        renderLiveConnections(payload);
    }

    async function refreshAdminProfile() {
        const payload = await fetchApi('/api/admin/profile', { user });
        const displayNameInput = document.getElementById('announceDisplayName');
        if (displayNameInput) {
            displayNameInput.value = payload.displayName || '';
        }
    }

    document.getElementById('refreshCodesBtn')?.addEventListener('click', async () => {
        setMessage('');
        try {
            await refreshCodes();
        } catch (error) {
            setMessage(error.message || 'Kod listesi alinamadi.', 'error');
        }
    });

    document.getElementById('refreshAccountsBtn')?.addEventListener('click', async () => {
        setMessage('');
        try {
            await refreshAccounts();
        } catch (error) {
            setMessage(error.message || 'Hesap listesi alinamadi.', 'error');
        }
    });

    document.getElementById('refreshLiveConnectionsBtn')?.addEventListener('click', async () => {
        setMessage('');
        try {
            await refreshLiveConnections();
        } catch (error) {
            setMessage(error.message || 'Canli baglanti listesi alinamadi.', 'error');
        }
    });

    document.getElementById('codeForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        setMessage('');

        const code = String(document.getElementById('codeValue').value || '').trim();
        if (!code) {
            setMessage('Kod alani zorunlu.', 'error');
            return;
        }

        const expiresAtRaw = document.getElementById('codeExpiresAt').value;
        const expiresAtIso = toIsoFromInput(expiresAtRaw);
        if (expiresAtRaw && !expiresAtIso) {
            setMessage('Son kullanma tarihi gecersiz.', 'error');
            return;
        }

        const payload = {
            code,
            label: String(document.getElementById('codeLabel').value || '').trim(),
            durationDays: Number(document.getElementById('codeDurationDays').value || 30),
            maxUses: Number(document.getElementById('codeMaxUses').value || 0),
            reuseCooldownDays: Number(document.getElementById('codeCooldownDays').value || 28),
            singleUsePerEmail: document.getElementById('codeSingleUse').checked,
            active: document.getElementById('codeActive').checked,
            expiresAt: expiresAtIso || null
        };

        const saveBtn = document.getElementById('saveCodeBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Kaydediliyor...';
        }

        try {
            await fetchApi('/api/premium/codes', {
                method: 'POST',
                user,
                body: payload
            });

            setMessage('Kod kaydedildi.', 'success');
            await refreshCodes();
        } catch (error) {
            setMessage(error.message || 'Kod kaydedilemedi.', 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Kodu Kaydet / Guncelle';
            }
        }
    });

    document.getElementById('codesList')?.addEventListener('click', (event) => {
        const button = event.target.closest('.code-edit-btn');
        if (!button) return;

        const targetCode = String(button.dataset.code || '');
        const codeEntry = cachedCodes.find((item) => item.code === targetCode);
        if (!codeEntry) return;

        fillCodeForm(codeEntry);
    });

    document.getElementById('grantForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        setMessage('');

        const email = String(document.getElementById('grantEmail').value || '').trim();
        const durationDays = Number(document.getElementById('grantDays').value || 30);
        if (!email) {
            setMessage('Hesap email alani zorunlu.', 'error');
            return;
        }

        const grantBtn = document.getElementById('grantBtn');
        if (grantBtn) {
            grantBtn.disabled = true;
            grantBtn.textContent = 'Isleniyor...';
        }

        try {
            await fetchApi('/api/premium/accounts/grant', {
                method: 'POST',
                user,
                body: { email, durationDays }
            });
            setMessage('Premium suresi guncellendi.', 'success');
            await refreshAccounts();
        } catch (error) {
            setMessage(error.message || 'Premium verilemedi.', 'error');
        } finally {
            if (grantBtn) {
                grantBtn.disabled = false;
                grantBtn.textContent = 'Premium Ver / Uzat';
            }
        }
    });

    document.getElementById('revokeBtn')?.addEventListener('click', async () => {
        setMessage('');
        const email = String(document.getElementById('grantEmail').value || '').trim();
        if (!email) {
            setMessage('Iptal icin email alani zorunlu.', 'error');
            return;
        }

        const revokeBtn = document.getElementById('revokeBtn');
        if (revokeBtn) {
            revokeBtn.disabled = true;
            revokeBtn.textContent = 'Isleniyor...';
        }

        try {
            await fetchApi('/api/premium/accounts/revoke', {
                method: 'POST',
                user,
                body: { email }
            });
            setMessage('Premium iptal edildi.', 'success');
            await refreshAccounts();
        } catch (error) {
            setMessage(error.message || 'Premium iptal edilemedi.', 'error');
        } finally {
            if (revokeBtn) {
                revokeBtn.disabled = false;
                revokeBtn.textContent = 'Premium Iptal Et';
            }
        }
    });

    document.getElementById('saveAnnouncementNameBtn')?.addEventListener('click', async () => {
        setMessage('');
        const displayNameInput = document.getElementById('announceDisplayName');
        const displayName = String(displayNameInput?.value || '').trim();

        if (!displayName) {
            setMessage('Duyuru ismi bos olamaz.', 'error');
            return;
        }

        if (displayName.length > 40) {
            setMessage('Duyuru ismi en fazla 40 karakter olabilir.', 'error');
            return;
        }

        const saveBtn = document.getElementById('saveAnnouncementNameBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Kaydediliyor...';
        }

        try {
            await fetchApi('/api/admin/profile', {
                method: 'POST',
                user,
                body: { displayName }
            });
            setMessage('Duyuru ismi kaydedildi.', 'success');
        } catch (error) {
            setMessage(error.message || 'Duyuru ismi kaydedilemedi.', 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Ismi Kaydet';
            }
        }
    });

    document.getElementById('announceForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        setMessage('');

        const announceInput = document.getElementById('announceMessage');
        const message = String(announceInput?.value || '').trim();
        if (!message) {
            setMessage('Duyuru mesaji bos olamaz.', 'error');
            return;
        }

        if (message.length > 300) {
            setMessage('Duyuru mesaji en fazla 300 karakter olabilir.', 'error');
            return;
        }

        const sendBtn = document.getElementById('sendAnnouncementBtn');
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.textContent = 'Gonderiliyor...';
        }

        try {
            const payload = await fetchApi('/api/admin/announce', {
                method: 'POST',
                user,
                body: { message }
            });

            if (announceInput) {
                announceInput.value = '';
            }

            const delivered = Number(payload?.deliveredToSockets || 0);
            setMessage(`Duyuru gonderildi. Ulasilan aktif baglanti: ${delivered}.`, 'success');
        } catch (error) {
            setMessage(error.message || 'Duyuru gonderilemedi.', 'error');
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Duyuruyu Gonder';
            }
        }
    });

    try {
        await Promise.all([refreshCodes(), refreshAccounts(), refreshLiveConnections(), refreshAdminProfile()]);

        liveRefreshTimer = window.setInterval(() => {
            refreshLiveConnections().catch((error) => {
                console.warn('[Admin] Live connections refresh failed:', error);
            });
        }, 15000);
    } catch (error) {
        setMessage(error.message || 'Veriler yuklenemedi.', 'error');
    }

    window.addEventListener('beforeunload', () => {
        if (liveRefreshTimer) {
            window.clearInterval(liveRefreshTimer);
        }
    });
}

initAdminPage().catch((error) => {
    console.error('[Admin] Init failed:', error);
    setMessage(error.message || 'Admin panel baslatilamadi.', 'error');
});
