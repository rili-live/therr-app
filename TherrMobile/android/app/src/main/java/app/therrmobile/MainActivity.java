package app.therrmobile;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.zoontek.rnbootsplash.RNBootSplash;

public class MainActivity extends ReactActivity {
  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  @Override
  protected String getMainComponentName() {
    return "Therr";
  }

  // Store the URL we're receiving from the share system
  public static String importUrl;


  // https://github.com/software-mansion/react-native-screens/issues/17#issuecomment-424704067
  @Override
  protected void onCreate(Bundle savedInstanceState) {
      RNBootSplash.init(this); // <- initialize the splash screen
      super.onCreate(null);
  }

  /**
   * Returns the instance of the {@link ReactActivityDelegate}. Here we use a util class {@link
   * DefaultReactActivityDelegate} which allows you to easily enable Fabric and Concurrent React
   * (aka React 18) with two boolean flags.
   */
  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {
    return new DefaultReactActivityDelegate(
        this,
        getMainComponentName(),
        // If you opted-in for the New Architecture, we enable the Fabric Renderer.
        DefaultNewArchitectureEntryPoint.getFabricEnabled());
  }

  @Override
  public void onNewIntent(Intent intent) {
      Uri uri = intent.getData();

      WritableMap someEvent = Arguments.createMap();
      String intentAction = intent.getAction();
      someEvent.putString("action", intentAction);

      // Bugfix: https://stackoverflow.com/questions/48445010/send-data-from-android-activity-to-react-native
      while (getReactInstanceManager().getCurrentReactContext() == null);

      getReactInstanceManager().getCurrentReactContext()
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
          .emit("new-intent-action", someEvent);

      if (uri != null) {
          String deepLinkURL = uri.toString();

          if (deepLinkURL.contains("verify-account")) {
              WritableMap event = Arguments.createMap();
              // Put data to map
              event.putString("url", deepLinkURL);
              // Get EventEmitter from context and send event thanks to it
              getReactInstanceManager().getCurrentReactContext()
                  .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                  .emit("url", event);
          } else {
              setIntent(intent);
          }
      } else {
          setIntent(intent);
      }

      super.onNewIntent(intent);
  }
}
