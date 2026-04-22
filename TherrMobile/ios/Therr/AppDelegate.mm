#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

#import <GoogleMaps/GoogleMaps.h>
#import <RNCConfig.h>
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
  self.dependencyProvider = [RCTAppDependencyProvider new];
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};
  
  if ([FIRApp defaultApp] == nil) {
      [FIRApp configure];
  }
  
  NSString *googleMapsApiKey = [RNCConfig envFor:@"GOOGLE_APIS_IOS_KEY"];
  [GMSServices provideAPIKey:googleMapsApiKey];

  // [REQUIRED] Register BackgroundFetch
  [[TSBackgroundFetch sharedInstance] didFinishLaunching];
  
  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}
 
- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

- (UIView *)createRootViewWithBridge:(RCTBridge *)bridge
                          moduleName:(NSString *)moduleName
                           initProps:(NSDictionary *)initProps {
  UIView *rootView = [super createRootViewWithBridge:bridge
                                          moduleName:moduleName
                                           initProps:initProps];

  [RNBootSplash initWithStoryboard:@"BootSplash" rootView:rootView]; // ⬅️ initialize the splash screen

  return rootView;
}

// APNS registration observability.
//
// Firebase's method swizzling (enabled by default — no
// FirebaseAppDelegateProxyEnabled=NO in Info.plist) still intercepts these
// callbacks and forwards the token to FIRMessaging for us, so we only log
// here; we do not set APNSToken manually. The goal is making silent APNS
// registration failures visible in device logs / Console.app so we can
// diagnose "why doesn't this iPhone get pushes" without guessing.
//
// Token contents are not logged — only the byte count — so device logs stay
// shareable.
- (void)application:(UIApplication *)application
    didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  NSLog(@"[APNS] Registered for remote notifications. Token length: %lu bytes",
        (unsigned long)deviceToken.length);
}

- (void)application:(UIApplication *)application
    didFailToRegisterForRemoteNotificationsWithError:(NSError *)error {
  NSLog(@"[APNS] Failed to register for remote notifications. Domain=%@ Code=%ld Description=%@",
        error.domain, (long)error.code, error.localizedDescription);
}

@end
