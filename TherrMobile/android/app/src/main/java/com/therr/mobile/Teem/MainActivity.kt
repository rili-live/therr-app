package com.therr.mobile.Teem

import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.zoontek.rnbootsplash.RNBootSplash


class MainActivity : ReactActivity() {
 
  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Teem"

  // Store the URL we're receiving from the share system
  var importUrl: String? = null


  // https://github.com/software-mansion/react-native-screens/issues/17#issuecomment-424704067
  override fun onCreate(savedInstanceState: Bundle?) {
    RNBootSplash.init(this, R.style.BootTheme) // <- initialize the splash screen
    super.onCreate(null)
  }
 
  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onNewIntent(intent: Intent) {
        val uri = intent.data
        val someEvent = Arguments.createMap()
        val intentAction = intent.action
        someEvent.putString("action", intentAction)

        // Bugfix: https://stackoverflow.com/questions/48445010/send-data-from-android-activity-to-react-native
        while (reactInstanceManager.currentReactContext == null);
        reactInstanceManager.currentReactContext!!
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("new-intent-action", someEvent)
        if (uri != null) {
            val deepLinkURL = uri.toString()
            if (deepLinkURL.contains("verify-account")) {
                val event = Arguments.createMap()
                // Put data to map
                event.putString("url", deepLinkURL)
                // Get EventEmitter from context and send event thanks to it
                reactInstanceManager.currentReactContext!!
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("url", event)
            } else {
                setIntent(intent)
            }
        } else {
            setIntent(intent)
        }
        super.onNewIntent(intent)
    }
}
