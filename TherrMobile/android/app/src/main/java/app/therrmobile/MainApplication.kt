package app.therrmobile

import android.app.Application
import app.therrmobile.modules.EdgeToEdgePackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.soloader.SoLoader
import com.facebook.react.soloader.OpenSourceMergedSoMapping

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost
    get() = getDefaultReactHost(
        context = applicationContext,
        packageList = PackageList(this).packages + listOf(EdgeToEdgePackage()),
        jsMainModulePath = "index",
        useDevSupport = BuildConfig.DEBUG,
    )

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
  }
}
