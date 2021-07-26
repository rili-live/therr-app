package app.therrmobile;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.devio.rn.splashscreen.SplashScreen;

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

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    SplashScreen.show(this);  // here

    super.onCreate(savedInstanceState);
  }

  @Override
  public void onNewIntent(Intent intent) {
      setIntent(intent); // TODO: Not sure if this should get called every time

      String deepLinkURL = intent.getData().toString();

      if (deepLinkURL.contains("verify-email")) {
          WritableMap event = Arguments.createMap();
          // Put data to map
          event.putString("url", deepLinkURL);
          // Get EventEmitter from context and send event thanks to it
          getReactInstanceManager().getCurrentReactContext()
              .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
              .emit("url", event);
      }

      super.onNewIntent(intent);
  }
}
