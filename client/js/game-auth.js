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

async function guardGamePage() {
    const firstUser = await waitForUser();
    if (!firstUser) {
        window.location.replace('/login.html');
        return;
    }

    setAuthSession(firstUser);

    onAuthChange((user) => {
        if (!user) {
            window.location.replace('/login.html');
            return;
        }
        setAuthSession(user);
    });
}

guardGamePage().catch((error) => {
    console.error('[Auth] Game guard failed:', error);
    window.location.replace('/login.html');
});
