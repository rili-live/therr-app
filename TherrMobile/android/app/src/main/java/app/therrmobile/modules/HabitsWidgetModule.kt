package app.therrmobile.modules

import android.content.Context
import app.therrmobile.widget.HabitsWidgetProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * JS → home-screen widget bridge. JS (main/utilities/habitsWidget.ts) owns what the widget
 * shows; this only stores the snapshot where HabitsWidgetProvider can read it and asks every
 * placed widget to redraw. The prefs file is app-private and holds no credentials.
 */
class HabitsWidgetModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun setSnapshot(json: String, promise: Promise) {
        try {
            prefs().edit().putString(HabitsWidgetProvider.KEY_SNAPSHOT, json).apply()
            HabitsWidgetProvider.refreshAll(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("HABITS_WIDGET_ERROR", e)
        }
    }

    @ReactMethod
    fun clear(promise: Promise) {
        try {
            prefs().edit().remove(HabitsWidgetProvider.KEY_SNAPSHOT).apply()
            HabitsWidgetProvider.refreshAll(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("HABITS_WIDGET_ERROR", e)
        }
    }

    private fun prefs() = reactApplicationContext
        .getSharedPreferences(HabitsWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)

    companion object {
        const val NAME = "HabitsWidget"
    }
}
