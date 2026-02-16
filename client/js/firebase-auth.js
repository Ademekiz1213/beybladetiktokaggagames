import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

let authInstance = null;
let initError = null;

function resolveFirebaseConfig() {
    const config = window.FIREBASE_CONFIG;
    if (!config) {
        return {
            error: new Error('Firebase config not found. Define window.FIREBASE_CONFIG in js/firebase-config.js')
        };
    }

    if (String(config.apiKey || '').startsWith('REPLACE_ME')) {
        return {
            error: new Error('Firebase config is placeholder. Update js/firebase-config.js with real values.')
        };
    }

    return { config };
}

function ensureAuthInitialized() {
    if (authInstance || initError) {
        return;
    }

    const { config, error } = resolveFirebaseConfig();
    if (error) {
        initError = error;
        return;
    }

    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    authInstance = getAuth(app);
}

function getReadyAuth() {
    ensureAuthInitialized();
    if (initError) {
        throw initError;
    }
    return authInstance;
}

export function getAuthInstance() {
    return getReadyAuth();
}

export function waitForUser() {
    return new Promise((resolve) => {
        const auth = getReadyAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            resolve(user || null);
        });
    });
}

export async function registerWithEmail(email, password) {
    const auth = getReadyAuth();
    return createUserWithEmailAndPassword(auth, email, password);
}

export async function loginWithEmail(email, password) {
    const auth = getReadyAuth();
    return signInWithEmailAndPassword(auth, email, password);
}

export async function logoutCurrentUser() {
    const auth = getReadyAuth();
    return signOut(auth);
}

export function getReadableAuthError(error) {
    const code = error?.code || '';

    switch (code) {
        case 'auth/email-already-in-use':
            return 'Bu email zaten kullaniliyor.';
        case 'auth/invalid-email':
            return 'Email formati gecersiz.';
        case 'auth/weak-password':
            return 'Sifre en az 6 karakter olmali.';
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return 'Email veya sifre hatali.';
        case 'auth/too-many-requests':
            return 'Cok fazla deneme yapildi. Biraz sonra tekrar dene.';
        default:
            return error?.message || 'Beklenmeyen bir hata olustu.';
    }
}
