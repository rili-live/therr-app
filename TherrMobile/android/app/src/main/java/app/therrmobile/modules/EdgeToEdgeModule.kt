package app.therrmobile.modules

import android.app.Activity
import android.graphics.Color
import android.os.Build
import androidx.core.view.WindowCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class EdgeToEdgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var previousNavigationBarColor: Int? = null
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
            if (previousNavigationBarColor == null) {
                previousNavigationBarColor = window.navigationBarColor
                previousDecorFitsSystemWindows = true
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    previousIsNavigationBarContrastEnforced = window.isNavigationBarContrastEnforced
                }
            }
            WindowCompat.setDecorFitsSystemWindows(window, false)
            window.navigationBarColor = Color.TRANSPARENT
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
            previousNavigationBarColor?.let { window.navigationBarColor = it }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                previousIsNavigationBarContrastEnforced?.let {
                    window.isNavigationBarContrastEnforced = it
                }
            }
            previousNavigationBarColor = null
            previousIsNavigationBarContrastEnforced = null
            promise.resolve(null)
        }
    }

    companion object {
        const val NAME = "EdgeToEdge"
    }
}
