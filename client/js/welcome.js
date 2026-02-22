import { waitForUser } from './firebase-auth.js';

async function initWelcome() {
    try {
        const user = await waitForUser();
        if (!user) return;

        const actions = document.querySelector('.auth-actions');
        if (!actions) return;

        if (!document.getElementById('dashboardEntryBtn')) {
            const dashboardBtn = document.createElement('a');
            dashboardBtn.id = 'dashboardEntryBtn';
            dashboardBtn.className = 'btn btn-secondary';
            dashboardBtn.href = '/dashboard.html';
            dashboardBtn.textContent = 'Dashboard';
            actions.appendChild(dashboardBtn);
        }
    } catch (error) {
        console.error('[Auth] Welcome init failed:', error);
    }
}

initWelcome();
