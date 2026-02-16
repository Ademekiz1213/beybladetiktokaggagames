import { logoutCurrentUser, waitForUser } from './firebase-auth.js';

function formatDate(value) {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString();
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
        console.warn('[Dashboard] Could not load Firebase token:', error);
    }

    return headers;
}

function setMessage(message, type = 'info') {
    const messageEl = document.getElementById('dashboardMessage');
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

function renderPremiumState(payload) {
    const premiumBadge = document.getElementById('premiumStateBadge');
    const premiumUntil = document.getElementById('premiumUntil');
    const premiumDays = document.getElementById('premiumDays');
    const adminPanelLink = document.getElementById('adminPanelLink');

    const isPremium = Boolean(payload?.premium);
    if (premiumBadge) {
        premiumBadge.textContent = isPremium ? 'Premium Aktif' : 'Premium Aktif Degil';
        premiumBadge.classList.toggle('is-on', isPremium);
        premiumBadge.classList.toggle('is-off', !isPremium);
    }

    if (premiumUntil) {
        premiumUntil.textContent = formatDate(payload?.premiumUntil);
    }

    if (premiumDays) {
        premiumDays.textContent = String(payload?.daysRemaining || 0);
    }

    if (adminPanelLink) {
        adminPanelLink.style.display = payload?.isAdmin ? 'inline-flex' : 'none';
    }
}

async function fetchPremiumState(user) {
    const response = await fetch('/api/premium/me', {
        method: 'GET',
        headers: await buildAuthHeaders(user, false)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Request failed (${response.status})`);
    }

    return payload;
}

async function initDashboard() {
    const user = await waitForUser();
    if (!user) {
        window.location.replace('/login.html');
        return;
    }

    const userEmail = document.getElementById('userEmail');
    if (userEmail) {
        userEmail.textContent = user.email || '-';
    }

    const refreshPremiumBtn = document.getElementById('refreshPremiumBtn');
    const redeemForm = document.getElementById('redeemForm');
    const redeemBtn = document.getElementById('redeemBtn');
    const activationCodeInput = document.getElementById('activationCodeInput');

    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', async () => {
        logoutBtn.disabled = true;
        logoutBtn.textContent = 'Cikis yapiliyor...';
        try {
            await logoutCurrentUser();
            window.location.replace('/login.html');
        } catch (error) {
            console.error('[Auth] Logout failed:', error);
            logoutBtn.disabled = false;
            logoutBtn.textContent = 'Cikis Yap';
        }
    });

    async function refreshPremium() {
        const payload = await fetchPremiumState(user);
        renderPremiumState(payload);
    }

    refreshPremiumBtn?.addEventListener('click', async () => {
        refreshPremiumBtn.disabled = true;
        refreshPremiumBtn.textContent = 'Yenileniyor...';
        setMessage('');
        try {
            await refreshPremium();
        } catch (error) {
            setMessage(error.message || 'Premium durumu alinamadi.', 'error');
        } finally {
            refreshPremiumBtn.disabled = false;
            refreshPremiumBtn.textContent = 'Durumu Yenile';
        }
    });

    redeemForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        setMessage('');

        const code = String(activationCodeInput?.value || '').trim();
        if (!code) {
            setMessage('Aktivasyon kodu girin.', 'error');
            return;
        }

        if (redeemBtn) {
            redeemBtn.disabled = true;
            redeemBtn.textContent = 'Aktif ediliyor...';
        }

        try {
            const response = await fetch('/api/premium/redeem', {
                method: 'POST',
                headers: await buildAuthHeaders(user, true),
                body: JSON.stringify({ code })
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || `Request failed (${response.status})`);
            }

            renderPremiumState(payload);
            setMessage('Kod aktif edildi. Premium suresi guncellendi.', 'success');

            if (activationCodeInput) {
                activationCodeInput.value = '';
            }
        } catch (error) {
            setMessage(error.message || 'Kod aktif edilemedi.', 'error');
        } finally {
            if (redeemBtn) {
                redeemBtn.disabled = false;
                redeemBtn.textContent = 'Kodu Aktif Et';
            }
        }
    });

    try {
        await refreshPremium();
    } catch (error) {
        renderPremiumState({ premium: false, premiumUntil: null, daysRemaining: 0, isAdmin: false });
        setMessage(error.message || 'Premium durumu alinamadi.', 'error');
    }
}

initDashboard().catch((error) => {
    console.error('[Auth] Dashboard init failed:', error);
    window.location.replace('/login.html');
});
