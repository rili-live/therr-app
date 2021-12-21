package app.therrmobile;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
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

//  @Override
//  protected void onCreate(Bundle savedInstanceState) {
//      RNBootSplash.show(this);  // here
//
//    super.onCreate(savedInstanceState);
//  }

  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {
    return new ReactActivityDelegate(this, getMainComponentName()) {

        @Override
        protected void loadApp(String appKey) {
            RNBootSplash.init(MainActivity.this); // <- initialize the splash screen
            super.loadApp(appKey);
        }
    };
  }

  @Override
  public void onNewIntent(Intent intent) {
      Uri uri = intent.getData();

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
