import { logoutCurrentUser, waitForUser } from './firebase-auth.js';

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
}

initDashboard().catch((error) => {
    console.error('[Auth] Dashboard init failed:', error);
    window.location.replace('/login.html');
});
