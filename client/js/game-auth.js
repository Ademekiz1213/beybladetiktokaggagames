import { logoutCurrentUser, waitForUser } from './firebase-auth.js';

function createAccountBar(user) {
    const bar = document.createElement('div');
    bar.id = 'accountBar';
    bar.style.position = 'fixed';
    bar.style.bottom = '20px';
    bar.style.left = '50%';
    bar.style.transform = 'translateX(-50%)';
    bar.style.zIndex = '120';
    bar.style.display = 'flex';
    bar.style.alignItems = 'center';
    bar.style.gap = '10px';
    bar.style.padding = '8px 12px';
    bar.style.background = 'rgba(8, 12, 25, 0.92)';
    bar.style.border = '1px solid rgba(255,255,255,0.12)';
    bar.style.borderRadius = '999px';
    bar.style.fontFamily = 'Inter, sans-serif';
    bar.style.fontSize = '12px';
    bar.style.color = '#d9e3ff';

    const email = document.createElement('span');
    email.textContent = user.email || '-';

    const dashboardLink = document.createElement('a');
    dashboardLink.href = '/dashboard.html';
    dashboardLink.textContent = 'Dashboard';
    dashboardLink.style.color = '#00d4ff';
    dashboardLink.style.textDecoration = 'none';

    const logoutButton = document.createElement('button');
    logoutButton.type = 'button';
    logoutButton.textContent = 'Cikis';
    logoutButton.style.border = 'none';
    logoutButton.style.borderRadius = '999px';
    logoutButton.style.padding = '6px 10px';
    logoutButton.style.cursor = 'pointer';
    logoutButton.style.background = 'rgba(239,68,68,0.2)';
    logoutButton.style.color = '#ff8f8f';

    logoutButton.addEventListener('click', async () => {
        logoutButton.disabled = true;
        logoutButton.textContent = '...';
        try {
            await logoutCurrentUser();
            window.location.replace('/login.html');
        } catch (error) {
            console.error('[Auth] Logout failed:', error);
            logoutButton.disabled = false;
            logoutButton.textContent = 'Cikis';
        }
    });

    bar.appendChild(email);
    bar.appendChild(dashboardLink);
    bar.appendChild(logoutButton);
    document.body.appendChild(bar);
}

async function guardGamePage() {
    const user = await waitForUser();
    if (!user) {
        window.location.replace('/login.html');
        return;
    }

    createAccountBar(user);
}

guardGamePage().catch((error) => {
    console.error('[Auth] Game guard failed:', error);
    window.location.replace('/login.html');
});
