package app.therrmobile.modules

import android.app.Activity
import android.os.Build
import androidx.core.view.WindowCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class EdgeToEdgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var hasEnabled: Boolean = false
    private var previousIsNavigationBarContrastEnforced: Boolean? = null
    private var previousDecorFitsSystemWindows: Boolean = true

    override fun getName(): String = NAME

    @ReactMethod
    fun enable(promise: Promise) {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Current activity is null")
            return
        }
        activity.runOnUiThread {
            val window = activity.window
            if (!hasEnabled) {
                previousDecorFitsSystemWindows = true
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    previousIsNavigationBarContrastEnforced = window.isNavigationBarContrastEnforced
                }
                hasEnabled = true
            }
            // Draw content behind the system bars. The navigation/status bars are
            // left transparent by Theme.EdgeToEdge — we intentionally do NOT touch
            // Window.navigationBarColor here, as those getters/setters are
            // deprecated no-ops on Android 15 (API 35+) and trip the Play Console
            // edge-to-edge deprecation report.
            WindowCompat.setDecorFitsSystemWindows(window, false)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                window.isNavigationBarContrastEnforced = false
            }
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun disable(promise: Promise) {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Current activity is null")
            return
        }
        activity.runOnUiThread {
            val window = activity.window
            WindowCompat.setDecorFitsSystemWindows(window, previousDecorFitsSystemWindows)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                previousIsNavigationBarContrastEnforced?.let {
                    window.isNavigationBarContrastEnforced = it
                }
            }
            hasEnabled = false
            previousIsNavigationBarContrastEnforced = null
            promise.resolve(null)
        }
    }

    companion object {
        const val NAME = "EdgeToEdge"
    }
}
