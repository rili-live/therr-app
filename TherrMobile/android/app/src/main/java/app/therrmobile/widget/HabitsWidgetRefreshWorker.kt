package app.therrmobile.widget

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.facebook.react.ReactApplication
import com.facebook.react.ReactInstanceEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import com.facebook.react.jstasks.HeadlessJsTaskEventListener
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Runs the widget's JS refresh task (`HabitsWidgetRefresh`, registered in index.js) without the
 * app open.
 *
 * A WorkManager job rather than a `HeadlessJsTaskService`: since Android 8 a service started
 * from a background process throws `IllegalStateException` unless the app is on a temporary
 * allowlist, and whether a launcher's widget broadcast grants one differs by OS version and
 * vendor. Enqueuing work is always allowed, the job runs inside this process with a wake lock
 * held for it, it waits for connectivity rather than failing offline, and it survives Doze by
 * deferring to the next maintenance window.
 *
 * The worker boots the React host if it is cold (the JS bundle, no UI), starts the headless task
 * and blocks its background thread until JS reports the task finished — or until the task's own
 * timeout, which `HeadlessJsTaskContext` enforces. Everything the task publishes goes through
 * HabitsWidgetModule; this class draws nothing itself.
 */
class HabitsWidgetRefreshWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        val application = applicationContext as? ReactApplication ?: return Result.failure()
        if (!HabitsWidgetProvider.hasWidgets(applicationContext)) {
            HabitsWidgetProvider.clearRefreshing(applicationContext)
            return Result.success()
        }

        val reason = inputData.getString(EXTRA_REASON) ?: REASON_PERIODIC
        val finished = CountDownLatch(1)
        val reactHost = application.reactHost
        if (reactHost == null) {
            HabitsWidgetProvider.clearRefreshing(applicationContext)
            return Result.failure()
        }

        UiThreadUtil.runOnUiThread {
            runCatching {
                val current = reactHost.currentReactContext
                if (current != null) {
                    startTask(current, reason, finished)
                } else {
                    reactHost.addReactInstanceEventListener(object : ReactInstanceEventListener {
                        override fun onReactContextInitialized(context: ReactContext) {
                            reactHost.removeReactInstanceEventListener(this)
                            startTask(context, reason, finished)
                        }
                    })
                    reactHost.start()
                }
            }.onFailure { finished.countDown() }
        }

        // Bounded by the task timeout plus the time a cold React host takes to come up. If JS
        // never reports back, the provider's own stale-flag window ends "Refreshing…" anyway.
        val completed = finished.await(TASK_TIMEOUT_MS + HOST_START_GRACE_MS, TimeUnit.MILLISECONDS)
        if (!completed) {
            HabitsWidgetProvider.clearRefreshing(applicationContext)
        }
        return Result.success()
    }

    /**
     * Starts the JS task and releases [finished] when it reports back. `startTask` must run on
     * the UI thread, and the react-context listener above is not guaranteed to call from it.
     */
    private fun startTask(reactContext: ReactContext, reason: String, finished: CountDownLatch) {
        UiThreadUtil.runOnUiThread {
            val taskContext = HeadlessJsTaskContext.getInstance(reactContext)
            var taskId = -1
            val listener = object : HeadlessJsTaskEventListener {
                override fun onHeadlessJsTaskStart(id: Int) = Unit
                override fun onHeadlessJsTaskFinish(id: Int) {
                    if (id == taskId) {
                        taskContext.removeTaskEventListener(this)
                        finished.countDown()
                    }
                }
            }
            taskContext.addTaskEventListener(listener)
            val data = Arguments.createMap().apply { putString(EXTRA_REASON, reason) }
            // Allowed in the foreground: with the app open the task still just fetches and
            // publishes, and refusing it would throw on the UI thread instead of skipping.
            val started = runCatching {
                taskContext.startTask(HeadlessJsTaskConfig(TASK_KEY, data, TASK_TIMEOUT_MS, true))
            }
            taskId = started.getOrDefault(-1)
            if (started.isFailure) {
                taskContext.removeTaskEventListener(listener)
                finished.countDown()
            }
        }
    }

    companion object {
        /** Must match `WIDGET_REFRESH_TASK_KEY` in main/utilities/habitsWidget.ts. */
        const val TASK_KEY = "HabitsWidgetRefresh"
        const val EXTRA_REASON = "reason"
        const val REASON_PERIODIC = "periodic"
        const val REASON_PLACED = "placed"
        const val REASON_TAP = "tap"

        private const val WORK_NAME = "habits_widget_refresh"
        private const val TASK_TIMEOUT_MS = 30_000L
        private const val HOST_START_GRACE_MS = 15_000L

        /**
         * Queue one refresh. `KEEP`: a refresh already queued or running answers this request
         * too, so a periodic tick landing on a tapped refresh does not start a second task.
         */
        fun enqueue(context: Context, reason: String) {
            val request = OneTimeWorkRequestBuilder<HabitsWidgetRefreshWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setInputData(workDataOf(EXTRA_REASON to reason))
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.KEEP, request)
        }
    }
}
