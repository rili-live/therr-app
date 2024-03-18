#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>

#import <GoogleMaps/GoogleMaps.h>
#import <ReactNativeConfig.h>
#import <Firebase.h>
#import "RNBootSplash.h"
#import <React/RCTLinkingManager.h>
#import <TSBackgroundFetch/TSBackgroundFetch.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url
  sourceApplication:(NSString *)sourceApplication annotation:(id)annotation
{
  return [RCTLinkingManager application:application openURL:url
                      sourceApplication:sourceApplication annotation:annotation];
}

// Only if your app is using [Universal Links](https://developer.apple.com/library/prerelease/ios/documentation/General/Conceptual/AppSearch/UniversalLinks.html).
- (BOOL)application:(UIApplication *)application continueUserActivity:(NSUserActivity *)userActivity
 restorationHandler:(void (^)(NSArray * _Nullable))restorationHandler
{
 return [RCTLinkingManager application:application
                  continueUserActivity:userActivity
                    restorationHandler:restorationHandler];
}

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"Therr";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};
  
  if ([FIRApp defaultApp] == nil) {
      [FIRApp configure];
  }
  
  NSString *googleMapsApiKey = [ReactNativeConfig envFor:@"GOOGLE_APIS_IOS_KEY"];
  +  [GMSServices provideAPIKey:googleMapsApiKey]; // add this line using the api key obtained from Google Console

  [RNBootSplash initWithStoryboard:@"BootSplash" rootView:self.window.rootViewController.view];

  // [REQUIRED] Register BackgroundFetch
  [[TSBackgroundFetch sharedInstance] didFinishLaunching];
  
  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self getBundleURL];
}
 
- (NSURL *)getBundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
