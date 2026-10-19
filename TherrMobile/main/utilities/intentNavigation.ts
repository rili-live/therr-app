/**
 * What an Android intent action should do to the navigator once Layout has
 * resolved it to a route (or failed to).
 *
 * WHY THIS EXISTS
 * Layout feeds two kinds of intent into the same handler: notification and
 * app-shortcut taps, which carry a brand-scoped action we route on, and the
 * launch intent itself, read on cold start through
 * `NativeModules.InitialIntent.getInitialAction()` and re-emitted by
 * `MainActivity.onNewIntent`. An ordinary launcher or Play Store "Open" tap
 * carries `android.intent.action.MAIN`, which routes nowhere.
 *
 * The handler used to send every signed-out user to Login whenever it ran,
 * with or without a route to return to. Since the launch intent always reaches
 * it, every signed-out cold start was pushed from Landing onto Login before the
 * user saw a single slide: in GA4, 17 of 22 paid Friends with Habits installs
 * (Oct 1-19 2026) viewed Login while `landing_sign_in_click` fired zero times,
 * and only 5 of them created an account.
 *
 * A Login detour only makes sense when there is somewhere to go after signing
 * in. With no target, the signed-out user stays where they are.
 */
export type IntentNavigation = 'login' | 'target' | null;

export const getIntentNavigation = (isNotAuthorized: boolean, targetRouteView?: string): IntentNavigation => {
    if (!targetRouteView) {
        return null;
    }

    return isNotAuthorized ? 'login' : 'target';
};
