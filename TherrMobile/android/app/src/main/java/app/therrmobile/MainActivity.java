package app.therrmobile;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.ReactRootView;
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
   * Returns the instance of the {@link ReactActivityDelegate}. There the RootView is created and
   * you can specify the renderer you wish to use - the new renderer (Fabric) or the old renderer
   * (Paper).
   */
  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {
    return new MainActivityDelegate(this, getMainComponentName());
  }

  public static class MainActivityDelegate extends ReactActivityDelegate {
    public MainActivityDelegate(ReactActivity activity, String mainComponentName) {
      super(activity, mainComponentName);
    }

    @Override
    protected ReactRootView createRootView() {
      ReactRootView reactRootView = new ReactRootView(getContext());
      // If you opted-in for the New Architecture, we enable the Fabric Renderer.
      reactRootView.setIsFabric(BuildConfig.IS_NEW_ARCHITECTURE_ENABLED);
      return reactRootView;
    }

    @Override
    protected boolean isConcurrentRootEnabled() {
      // If you opted-in for the New Architecture, we enable Concurrent Root (i.e. React 18).
      // More on this on https://reactjs.org/blog/2022/03/29/react-v18.html
      return BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
    }
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
