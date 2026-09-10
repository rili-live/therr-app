import SecureStorage from './SecureStorage';
import { getIdentifierType } from './authIdentifier';

/**
 * Locally remembered accounts, so the sign-in screen can pre-fill the last identifier used on
 * this device and offer a one-tap switch between accounts (personal / creator / business, or a
 * shared handset).
 *
 * This is a convenience cache, never a credential: it holds no password, token, or session.
 * It survives sign-out on purpose — that is the entire point — and is stored through
 * `SecureStorage` (Keychain-backed where available) because it contains contact info.
 */

const STORAGE_KEY = 'therrKnownProfiles';

// Enough for a family handset or someone juggling a personal + business account, small enough
// that the switcher stays a glanceable list rather than something you scroll.
const MAX_REMEMBERED_PROFILES = 5;

export interface IRememberedProfile {
    /** User id, the identity key for de-duplication. */
    id: string;
    /** Exactly what should be typed back into the sign-in field (email, phone, or username). */
    identifier: string;
    identifierType: 'email' | 'phone' | 'userName';
    userName?: string;
    firstName?: string;
    lastName?: string;
    /** Profile media blob, in the shape `getUserImageUri` expects under `details`. */
    media?: any;
    /** Epoch ms, used to order the switcher most-recent-first. */
    lastLoginAt: number;
}

const parseProfiles = (raw: string | null): IRememberedProfile[] => {
    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);
        // Tolerate a corrupt or pre-format value rather than breaking sign-in over it.
        return Array.isArray(parsed) ? parsed.filter((profile) => profile?.id && profile?.identifier) : [];
    } catch {
        return [];
    }
};

const persist = (profiles: IRememberedProfile[]) => SecureStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));

/**
 * Remembered accounts, most recently used first.
 */
export const getRememberedProfiles = async (): Promise<IRememberedProfile[]> => {
    const profiles = parseProfiles(await SecureStorage.getItem(STORAGE_KEY));

    return profiles.sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0));
};

/**
 * Inserts or refreshes one account. De-duplicates on `id`, so signing in with a phone number
 * after previously using an email updates the existing entry instead of adding a second one.
 */
export const rememberProfile = async (profile: Omit<IRememberedProfile, 'lastLoginAt' | 'identifierType'> & {
    lastLoginAt?: number;
}): Promise<IRememberedProfile[]> => {
    if (!profile?.id || !profile?.identifier) {
        return getRememberedProfiles();
    }

    const existing = await getRememberedProfiles();
    const entry: IRememberedProfile = {
        ...profile,
        identifierType: getIdentifierType(profile.identifier),
        lastLoginAt: profile.lastLoginAt || Date.now(),
    };
    const updated = [entry, ...existing.filter((candidate) => candidate.id !== profile.id)]
        .slice(0, MAX_REMEMBERED_PROFILES);

    await persist(updated);

    return updated;
};

export const forgetProfile = async (userId: string): Promise<IRememberedProfile[]> => {
    const remaining = (await getRememberedProfiles()).filter((profile) => profile.id !== userId);

    await persist(remaining);

    return remaining;
};

export const forgetAllProfiles = (): Promise<void> => SecureStorage.removeItem(STORAGE_KEY);

/**
 * Records whoever is signed in right now, reading the session blob the auth actions just
 * wrote. Call after a successful sign-in of any kind (password, SMS code, SSO).
 *
 * Prefers the identifier the user actually typed, so the field pre-fills with what they are
 * used to seeing rather than whichever column the account happens to have populated.
 * Fire-and-forget: a failure must never surface on a successful sign-in.
 */
export const rememberCurrentUser = async (typedIdentifier?: string): Promise<void> => {
    try {
        const storedUser = JSON.parse(await SecureStorage.getItem('therrUser') || 'null');

        if (!storedUser?.id) {
            return;
        }

        const identifier = typedIdentifier?.trim()
            || storedUser.email
            || storedUser.phoneNumber
            || storedUser.userName;

        if (!identifier) {
            return;
        }

        await rememberProfile({
            id: storedUser.id,
            identifier,
            userName: storedUser.userName,
            firstName: storedUser.firstName,
            lastName: storedUser.lastName,
            media: storedUser.media,
        });
    } catch {
        // Remembering a profile is a convenience; never let it break the sign-in it follows.
    }
};

export default {
    getRememberedProfiles,
    rememberProfile,
    rememberCurrentUser,
    forgetProfile,
    forgetAllProfiles,
};
