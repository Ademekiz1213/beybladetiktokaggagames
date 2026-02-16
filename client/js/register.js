import { getReadableAuthError, registerWithEmail, waitForUser } from './firebase-auth.js';

function setLoading(button, loading) {
    button.disabled = loading;
    button.textContent = loading ? 'Kayit olusturuluyor...' : 'Kayit Ol';
}

function showError(el, message) {
    el.textContent = message;
    el.style.display = 'block';
}

function hideError(el) {
    el.style.display = 'none';
}

async function initRegisterPage() {
    const currentUser = await waitForUser();
    if (currentUser) {
        window.location.replace('/dashboard.html');
        return;
    }

    const form = document.getElementById('registerForm');
    const button = document.getElementById('registerBtn');
    const errorEl = document.getElementById('registerError');

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
            await registerWithEmail(email, password);
            window.location.replace('/dashboard.html');
        } catch (error) {
            showError(errorEl, getReadableAuthError(error));
        } finally {
            setLoading(button, false);
        }
    });
}

initRegisterPage().catch((error) => {
    console.error('[Auth] Register init failed:', error);
    const errorEl = document.getElementById('registerError');
    if (errorEl) {
        showError(errorEl, error.message || 'Sayfa baslatilamadi.');
    }
});
