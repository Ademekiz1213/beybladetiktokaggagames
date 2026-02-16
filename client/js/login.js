import { getReadableAuthError, loginWithEmail, waitForUser } from './firebase-auth.js';

function setLoading(button, loading) {
    button.disabled = loading;
    button.textContent = loading ? 'Giris yapiliyor...' : 'Giris Yap';
}

function showError(el, message) {
    el.textContent = message;
    el.style.display = 'block';
}

function hideError(el) {
    el.style.display = 'none';
}

async function initLoginPage() {
    const currentUser = await waitForUser();
    if (currentUser) {
        window.location.replace('/dashboard.html');
        return;
    }

    const form = document.getElementById('loginForm');
    const button = document.getElementById('loginBtn');
    const errorEl = document.getElementById('loginError');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideError(errorEl);

        const email = form.email.value.trim();
        const password = form.password.value;

        if (!email || !password) {
            showError(errorEl, 'Email ve sifre zorunlu.');
            return;
        }

        setLoading(button, true);
        try {
            await loginWithEmail(email, password);
            window.location.replace('/dashboard.html');
        } catch (error) {
            showError(errorEl, getReadableAuthError(error));
        } finally {
            setLoading(button, false);
        }
    });
}

initLoginPage().catch((error) => {
    console.error('[Auth] Login init failed:', error);
    const errorEl = document.getElementById('loginError');
    if (errorEl) {
        showError(errorEl, error.message || 'Sayfa baslatilamadi.');
    }
});
