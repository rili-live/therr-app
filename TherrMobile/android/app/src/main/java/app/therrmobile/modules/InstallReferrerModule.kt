package app.therrmobile.modules

import android.content.Context
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Reads the Play Store install referrer so a paid install can be attributed.
 *
 * WHY THIS EXISTS
 * A Google App campaign sends the user to the Play Store, not to a page we
 * control, so no UTM is ever set in a browser and `main."userAcquisition"`
 * records nothing: the account a paid install creates is indistinguishable from
 * an organic one, and every conclusion about the app arm's users is inference.
 * The Play Install Referrer API is the one channel that carries the campaign
 * across that gap — Play hands back the `referrer` string Google Ads attached to
 * the click, `utm_*` parameters intact.
 *
 * WHY IT IS A FIRST-PARTY MODULE RATHER THAN A DEPENDENCY
 * The whole surface is one call against `com.android.installreferrer`, which is
 * a Google library already required for this to work at all. A wrapper package
 * would add a patch-package version to track and a Jest transform to configure
 * for no code we would not still be writing.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * No parsing. The referrer is returned as the raw string Play gave us, and JS
 * decides what a UTM is — that keeps the parsing rules in one place
 * (installReferrer.ts) next to the shape the API expects, and testable without
 * an emulator.
 *
 * FAILURE IS NORMAL HERE AND MUST BE QUIET
 * `getInstallReferrer` never rejects. Play services can be absent, the API can
 * return FEATURE_NOT_SUPPORTED on an old Play Store, an organic install has no
 * referrer at all, and a sideloaded debug build has no Play connection
 * whatsoever. All four are ordinary, none is an error the user could act on,
 * and attribution must never be what stops a registration — so every one of
 * them resolves null.
 */
class InstallReferrerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun getInstallReferrer(promise: Promise) {
        val context: Context = reactApplicationContext

        val client = try {
            InstallReferrerClient.newBuilder(context).build()
        } catch (error: Throwable) {
            promise.resolve(null)
            return
        }

        // The listener contract does not promise a single call: a disconnect
        // during setup can deliver onInstallReferrerSetupFinished and then
        // onInstallReferrerServiceDisconnected. Resolving a Promise twice
        // throws on the JS side, so the first outcome wins and the rest are
        // dropped.
        val isSettled = AtomicBoolean(false)

        fun settle(value: WritableMap?) {
            if (isSettled.compareAndSet(false, true)) {
                promise.resolve(value)
            }
            try {
                client.endConnection()
            } catch (error: Throwable) {
                // Already closed, or the service died. Nothing to do.
            }
        }

        try {
            client.startConnection(object : InstallReferrerStateListener {
                override fun onInstallReferrerSetupFinished(responseCode: Int) {
                    if (responseCode != InstallReferrerClient.InstallReferrerResponse.OK) {
                        // SERVICE_UNAVAILABLE, FEATURE_NOT_SUPPORTED,
                        // DEVELOPER_ERROR. None is actionable at runtime.
                        settle(null)
                        return
                    }

                    val details = try {
                        client.installReferrer
                    } catch (error: Throwable) {
                        settle(null)
                        return
                    }

                    settle(
                        Arguments.createMap().apply {
                            putString("referrer", details.installReferrer)
                            // Play's own timestamps, in seconds. Carried through
                            // so a referrer whose click predates the install by
                            // an implausible margin can be discarded later
                            // rather than credited.
                            putDouble("clickTimestamp", details.referrerClickTimestampSeconds.toDouble())
                            putDouble("installTimestamp", details.installBeginTimestampSeconds.toDouble())
                        },
                    )
                }

                override fun onInstallReferrerServiceDisconnected() {
                    settle(null)
                }
            })
        } catch (error: Throwable) {
            // startConnection throws on some OEM builds when Play services are
            // missing outright, rather than reporting it through the listener.
            settle(null)
        }
    }

    companion object {
        const val NAME = "InstallReferrer"
    }
}
