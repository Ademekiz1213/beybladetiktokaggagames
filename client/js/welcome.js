import { waitForUser } from './firebase-auth.js';

async function initWelcome() {
    try {
        const user = await waitForUser();
        if (user) {
            window.location.replace('/dashboard.html');
        }
    } catch (error) {
        console.error('[Auth] Welcome init failed:', error);
    }
}

initWelcome();
