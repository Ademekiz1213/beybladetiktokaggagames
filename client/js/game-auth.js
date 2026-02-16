import { logoutCurrentUser, onAuthChange, waitForUser } from './firebase-auth.js';

function setAuthSession(user) {
    window.authSession = {
        user,
        async getIdToken(forceRefresh = false) {
            if (!user) return null;
            return user.getIdToken(forceRefresh);
        },
        async logout() {
            await logoutCurrentUser();
        }
    };

    window.dispatchEvent(new CustomEvent('auth-ready', { detail: { user } }));
}

async function buildAuthHeaders(user) {
    const headers = {};

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
        console.warn('[Auth] Could not load Firebase token for premium check:', error);
    }

    return headers;
}

async function checkPremiumAccess(user) {
    const response = await fetch('/api/premium/me', {
        method: 'GET',
        headers: await buildAuthHeaders(user)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Premium check failed (${response.status})`);
    }

    return Boolean(payload.premium);
}

function redirectPremiumRequired(reason = 'required') {
    window.location.replace(`/dashboard.html?premium=${encodeURIComponent(reason)}`);
}

async function guardGamePage() {
    const firstUser = await waitForUser();
    if (!firstUser) {
        window.location.replace('/login.html');
        return;
    }

    try {
        const hasPremium = await checkPremiumAccess(firstUser);
        if (!hasPremium) {
            redirectPremiumRequired('required');
            return;
        }
    } catch (error) {
        console.error('[Auth] Premium check failed:', error);
        redirectPremiumRequired('verify_failed');
        return;
    }

    setAuthSession(firstUser);

    onAuthChange(async (user) => {
        if (!user) {
            window.location.replace('/login.html');
            return;
        }

        try {
            const hasPremium = await checkPremiumAccess(user);
            if (!hasPremium) {
                redirectPremiumRequired('required');
                return;
            }
        } catch (error) {
            console.error('[Auth] Premium re-check failed:', error);
            redirectPremiumRequired('verify_failed');
            return;
        }

        setAuthSession(user);
    });
}

guardGamePage().catch((error) => {
    console.error('[Auth] Game guard failed:', error);
    window.location.replace('/login.html');
});
