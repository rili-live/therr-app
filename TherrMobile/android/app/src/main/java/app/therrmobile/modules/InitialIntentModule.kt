package app.therrmobile.modules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Exposes the launch Intent's action to JS for the cold-start case.
 *
 * Warm/background taps on an app shortcut (long-press launcher menu) arrive
 * via MainActivity.onNewIntent, which already emits a "new-intent-action"
 * event. But a shortcut tapped while the app is killed goes through onCreate,
 * not onNewIntent, so nothing pushes that action to JS. Layout reads it once
 * on mount via getInitialAction().
 *
 * The action is cleared after the first read so subsequent Layout remounts
 * (e.g. the login/logout cycle) don't re-trigger navigation from a stale
 * launch intent.
 */
class InitialIntentModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun getInitialAction(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.resolve(null)
            return
        }
        val intent = activity.intent
        val action = intent?.action
        // Consume it so a Layout remount doesn't re-navigate from the same launch.
        intent?.action = null
        promise.resolve(action)
    }

    companion object {
        const val NAME = "InitialIntent"
    }
}
