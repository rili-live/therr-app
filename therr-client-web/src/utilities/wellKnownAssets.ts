/**
 * Hostnames served by the Friends with Habits brand. habits.therr.com and
 * www.habits.therr.com are routed by the k8s ingress to the same pod that serves
 * therr.com, so every host-specific behaviour keys off this set.
 */
export const HABITS_HOSTS = new Set(['habits.therr.com', 'www.habits.therr.com']);

/**
 * Picks the Digital Asset Links file for a hostname.
 *
 * Each host claimed by an `android:autoVerify` intent-filter must serve an
 * assetlinks.json naming *that build's* applicationId — see the appLinkHostsByAppId
 * map in TherrMobile/android/app/build.gradle. habits.therr.com is claimed by
 * com.therr.habits; therr.com by app.therrmobile. Serving the wrong file fails
 * verification silently and Android hands the link back to the browser.
 */
export const resolveAssetLinksFileName = (hostname: string): string => (
    HABITS_HOSTS.has(hostname) ? 'assetlinks.habits.json' : 'assetlinks.json'
);
