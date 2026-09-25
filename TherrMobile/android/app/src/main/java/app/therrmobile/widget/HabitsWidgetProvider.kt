package app.therrmobile.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.res.Configuration
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import app.therrmobile.MainActivity
import app.therrmobile.R
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlin.math.ceil
import kotlin.math.max

/**
 * Friends with Habits home-screen widget: weekly rank, XP, daily streak, today's check-ins and
 * the top of the friends leaderboard.
 *
 * It only renders. The app writes a JSON snapshot through HabitsWidgetModule (built by
 * main/utilities/habitsWidget.ts) and this provider draws it — no network, no auth token here.
 *
 * Fresh data comes from two directions. The app publishes after each dashboard refresh and
 * check-in. Between app sessions the widget asks for it: on every `updatePeriodMillis` tick, on
 * first placement and on a tap of its "updated N ago" label it queues
 * [HabitsWidgetRefreshWorker], which runs the JS refresh task headlessly with the stored session
 * and publishes through the same module. While that runs the label reads "Refreshing…", keyed
 * off a timestamp in prefs that the module clears when JS publishes or gives up (and that this
 * provider ignores once it is old enough to be a crashed task).
 *
 * Taps are explicit intents to MainActivity carrying a `<package>.WIDGET_*` action. The
 * existing shortcut plumbing delivers them to JS: onNewIntent emits "new-intent-action" on a
 * warm start, and InitialIntentModule hands the launch action to Layout on a cold start. The
 * refresh tap is the exception: a broadcast back to this receiver, so it needs no app launch.
 */
class HabitsWidgetProvider : AppWidgetProvider() {

    override fun onEnabled(context: Context) {
        // The first widget just landed on a home screen. Fill it now rather than at the first
        // periodic tick — the empty state shows "Loading…" until JS publishes.
        requestRefresh(context, HabitsWidgetRefreshWorker.REASON_PLACED)
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        // Ask first so the redraw below already shows "Refreshing…" when a fetch was queued.
        requestRefresh(context, HabitsWidgetRefreshWorker.REASON_PERIODIC)
        val snapshot = readSnapshot(context)
        appWidgetIds.forEach { id -> draw(context, appWidgetManager, id, snapshot) }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle,
    ) {
        // Resizing changes how many leaderboard rows fit.
        draw(context, appWidgetManager, appWidgetId, readSnapshot(context))
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == refreshAction(context)) {
            requestRefresh(context, HabitsWidgetRefreshWorker.REASON_TAP)
            refreshAll(context)
            return
        }
        super.onReceive(context, intent)
    }

    companion object {
        const val PREFS_NAME = "habits_widget"
        const val KEY_SNAPSHOT = "snapshot"
        /** Epoch millis of the last refresh request still believed to be running, or absent. */
        const val KEY_REFRESHING_SINCE = "refreshingSince"

        private const val ACTION_OPEN_APP = "WIDGET_OPEN_APP"
        private const val ACTION_OPEN_LEADERBOARD = "WIDGET_OPEN_LEADERBOARD"
        private const val ACTION_OPEN_LEADERBOARD_GLOBAL = "WIDGET_OPEN_LEADERBOARD_GLOBAL"
        private const val ACTION_OPEN_TODAY = "WIDGET_OPEN_TODAY"
        private const val ACTION_INVITE_FRIENDS = "WIDGET_INVITE_FRIENDS"
        private const val ACTION_REFRESH = "WIDGET_REFRESH"

        private const val MINUTE_MS = 60L * 1000
        private const val HOUR_MS = 60 * MINUTE_MS
        private const val DAY_MS = 24 * HOUR_MS

        /**
         * A periodic tick within this long of the last publish fetches nothing: the app was just
         * open, and the tick's redraw from the snapshot is all that is needed. A tap always
         * fetches.
         */
        private const val FRESH_ENOUGH_MS = 5 * MINUTE_MS

        /**
         * How long a refresh request is believed to still be running. The JS task times out at
         * 30s and a cold React host adds a few more, so a flag older than this belongs to a task
         * that died without reporting back; it is ignored rather than left reading "Refreshing…".
         */
        private const val REFRESH_IN_FLIGHT_MS = 60L * 1000

        private fun prefs(context: Context): SharedPreferences =
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        private fun widgetIds(context: Context): IntArray =
            AppWidgetManager.getInstance(context)
                .getAppWidgetIds(ComponentName(context, HabitsWidgetProvider::class.java))

        /** Whether at least one widget is placed. The refresh worker skips its fetch otherwise. */
        fun hasWidgets(context: Context): Boolean = widgetIds(context).isNotEmpty()

        /** Redraw every placed widget from the stored snapshot. */
        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = widgetIds(context)
            if (ids.isEmpty()) return
            val snapshot = readSnapshot(context)
            ids.forEach { id -> draw(context, manager, id, snapshot) }
        }

        /** End the "Refreshing…" state without a new snapshot, and redraw. */
        fun clearRefreshing(context: Context) {
            prefs(context).edit().remove(KEY_REFRESHING_SINCE).apply()
            refreshAll(context)
        }

        /**
         * Queue a background refresh unless one is already running, or — for a periodic tick —
         * the snapshot is fresh enough already. Marks the widget as refreshing first, so a redraw
         * that follows shows it.
         */
        fun requestRefresh(context: Context, reason: String) {
            if (!hasWidgets(context)) return
            val prefs = prefs(context)
            val now = System.currentTimeMillis()
            if (isRefreshing(prefs, now)) return
            if (reason != HabitsWidgetRefreshWorker.REASON_TAP) {
                val updatedAt = readSnapshot(context)?.optLong("updatedAt", 0L) ?: 0L
                if (now - updatedAt in 0 until FRESH_ENOUGH_MS) return
            }
            prefs.edit().putLong(KEY_REFRESHING_SINCE, now).apply()
            runCatching { HabitsWidgetRefreshWorker.enqueue(context, reason) }
                .onFailure { prefs.edit().remove(KEY_REFRESHING_SINCE).apply() }
        }

        private fun isRefreshing(prefs: SharedPreferences, now: Long): Boolean {
            val since = prefs.getLong(KEY_REFRESHING_SINCE, 0L)
            return since > 0L && now - since in 0 until REFRESH_IN_FLIGHT_MS
        }

        private fun readSnapshot(context: Context): JSONObject? {
            val raw = prefs(context).getString(KEY_SNAPSHOT, null) ?: return null
            return runCatching { JSONObject(raw) }.getOrNull()
        }

        private fun rowsForHeight(heightDp: Int): Int = when {
            heightDp <= 0 -> 1
            heightDp < 150 -> 1
            heightDp < 190 -> 2
            else -> 3
        }

        /**
         * The widget's height in dp in the current orientation. The launcher reports a range, and
         * the two ends are not "small" and "large": OPTION_APPWIDGET_MAX_HEIGHT is the portrait
         * height and OPTION_APPWIDGET_MIN_HEIGHT the (much shorter) landscape one. Reading MIN on
         * a phone in portrait sized the board for landscape and drew one row into room for three.
         */
        private fun currentHeightDp(context: Context, manager: AppWidgetManager, appWidgetId: Int): Int {
            val options = manager.getAppWidgetOptions(appWidgetId)
            val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
            val maxHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)
            val isLandscape = context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
            return if (isLandscape || maxHeight <= 0) minHeight else maxHeight
        }

        /** Epoch millis of the period's reset instant (`periodEnd` is a UTC date), or null. */
        private fun periodEndMillis(periodEnd: String?): Long? {
            if (periodEnd.isNullOrEmpty()) return null
            return runCatching {
                SimpleDateFormat("yyyy-MM-dd", Locale.US)
                    .apply { timeZone = TimeZone.getTimeZone("UTC") }
                    .parse(periodEnd)?.time
            }.getOrNull()
        }

        /**
         * "5m ago" / "2h ago" / "3d ago" / "just now", from the snapshot's own label templates
         * so it follows the in-app locale. Empty when the snapshot predates the labels.
         */
        private fun agoLabel(labels: JSONObject, updatedAt: Long, now: Long): String {
            val elapsed = max(0L, now - updatedAt)
            return when {
                elapsed < MINUTE_MS -> labels.optString("justNow")
                elapsed < HOUR_MS -> labels.optString("minutesAgo").replace("{minutes}", (elapsed / MINUTE_MS).toString())
                elapsed < DAY_MS -> labels.optString("hoursAgo").replace("{hours}", (elapsed / HOUR_MS).toString())
                else -> labels.optString("daysAgo").replace("{days}", (elapsed / DAY_MS).toString())
            }
        }

        private fun draw(context: Context, manager: AppWidgetManager, appWidgetId: Int, snapshot: JSONObject?) {
            val views = RemoteViews(context.packageName, R.layout.widget_habits)
            val now = System.currentTimeMillis()
            val isRefreshing = isRefreshing(prefs(context), now)

            if (snapshot == null) {
                views.setViewVisibility(R.id.widget_content, View.GONE)
                views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
                views.setTextViewText(
                    R.id.widget_empty,
                    context.getString(if (isRefreshing) R.string.habits_widget_loading else R.string.habits_widget_empty),
                )
                views.setOnClickPendingIntent(R.id.widget_root, tapIntent(context, ACTION_OPEN_APP, 0))
                manager.updateAppWidget(appWidgetId, views)
                return
            }

            views.setViewVisibility(R.id.widget_empty, View.GONE)
            views.setViewVisibility(R.id.widget_content, View.VISIBLE)

            val labels = snapshot.optJSONObject("labels") ?: JSONObject()
            val you = snapshot.optJSONObject("you") ?: JSONObject()
            val today = snapshot.optJSONObject("today") ?: JSONObject()
            val isFriendsBoard = snapshot.optString("scope") == "connections"
            val leaderboardAction = if (isFriendsBoard) ACTION_OPEN_LEADERBOARD else ACTION_OPEN_LEADERBOARD_GLOBAL

            val resetAt = periodEndMillis(snapshot.optString("periodEnd", ""))
            val isStaleWeek = resetAt != null && now >= resetAt

            // Header
            views.setTextViewText(R.id.widget_title, labels.optString("title"))
            if (resetAt != null && !isStaleWeek) {
                val days = max(1, ceil((resetAt - now).toDouble() / DAY_MS).toInt())
                views.setTextViewText(
                    R.id.widget_reset,
                    labels.optString("resetsIn").replace("{days}", days.toString()),
                )
                views.setViewVisibility(R.id.widget_reset, View.VISIBLE)
            } else {
                views.setViewVisibility(R.id.widget_reset, View.GONE)
            }

            // Freshness. Its own tap target: a refresh, not a launch.
            val ago = agoLabel(labels, snapshot.optLong("updatedAt", 0L), now)
            if (isRefreshing) {
                views.setTextViewText(
                    R.id.widget_updated,
                    labels.optString("refreshing", context.getString(R.string.habits_widget_refreshing)),
                )
            } else {
                views.setTextViewText(R.id.widget_updated, if (ago.isEmpty()) "↻" else "↻ $ago")
            }
            val hintTemplate = labels.optString("refreshHint")
            views.setContentDescription(
                R.id.widget_updated,
                if (hintTemplate.isEmpty() || ago.isEmpty()) {
                    context.getString(R.string.habits_widget_refresh_hint)
                } else {
                    hintTemplate.replace("{ago}", ago)
                },
            )
            views.setOnClickPendingIntent(R.id.widget_updated, refreshIntent(context))

            // Your standing. Last week's rank is wrong the moment the week resets, so say so
            // instead of showing it.
            if (isStaleWeek) {
                views.setViewVisibility(R.id.widget_stats, View.GONE)
                views.setViewVisibility(R.id.widget_new_week, View.VISIBLE)
                views.setTextViewText(R.id.widget_new_week, labels.optString("newWeek"))
            } else {
                views.setViewVisibility(R.id.widget_new_week, View.GONE)
                views.setViewVisibility(R.id.widget_stats, View.VISIBLE)
                val rank = you.optInt("rank", 0)
                views.setTextViewText(R.id.widget_rank, if (rank > 0) "#$rank" else "–")
                views.setTextViewText(R.id.widget_rank_context, labels.optString("rankContext"))
                views.setTextViewText(R.id.widget_points, labels.optString("points"))
                val streak = you.optInt("dailyStreak", 0)
                if (streak > 0) {
                    views.setTextViewText(R.id.widget_streak, "🔥 $streak")
                    views.setViewVisibility(R.id.widget_streak, View.VISIBLE)
                } else {
                    views.setViewVisibility(R.id.widget_streak, View.GONE)
                }
            }
            val leaderboardTap = tapIntent(context, leaderboardAction, 1)
            views.setOnClickPendingIntent(R.id.widget_title, leaderboardTap)
            views.setOnClickPendingIntent(R.id.widget_reset, leaderboardTap)
            views.setOnClickPendingIntent(R.id.widget_stats, leaderboardTap)
            views.setOnClickPendingIntent(R.id.widget_new_week, leaderboardTap)

            // Today's check-ins. Not tied to the leaderboard week, so it is shown either way.
            val total = today.optInt("total", 0)
            val done = today.optInt("done", 0)
            views.setTextViewText(R.id.widget_today_label, labels.optString("today"))
            views.setTextViewText(R.id.widget_today_progress, labels.optString("todayProgress"))
            views.setProgressBar(R.id.widget_today_bar, max(total, 1), if (total > 0) done else 0, false)
            views.setOnClickPendingIntent(R.id.widget_today, tapIntent(context, ACTION_OPEN_TODAY, 2))

            // Top of the board.
            views.removeAllViews(R.id.widget_rows)
            if (!isStaleWeek) {
                val maxRows = rowsForHeight(currentHeightDp(context, manager, appWidgetId))
                val top = snapshot.optJSONArray("top")
                val entryCount = minOf(top?.length() ?: 0, maxRows)
                for (i in 0 until entryCount) {
                    val entry = top!!.optJSONObject(i) ?: continue
                    views.addView(R.id.widget_rows, rowViews(context, entry))
                }
                // No friends yet: the global board is standing in, so ask for the thing the
                // app is named after.
                if (!isFriendsBoard && entryCount < maxRows) {
                    val invite = RemoteViews(context.packageName, R.layout.widget_habits_invite)
                    invite.setTextViewText(R.id.widget_invite, labels.optString("invite"))
                    invite.setOnClickPendingIntent(R.id.widget_invite, tapIntent(context, ACTION_INVITE_FRIENDS, 3))
                    views.addView(R.id.widget_rows, invite)
                }
            }
            views.setOnClickPendingIntent(R.id.widget_rows, leaderboardTap)

            manager.updateAppWidget(appWidgetId, views)
        }

        private fun rowViews(context: Context, entry: JSONObject): RemoteViews {
            val row = RemoteViews(context.packageName, R.layout.widget_habits_row)
            val isYou = entry.optBoolean("isYou", false)
            row.setTextViewText(R.id.widget_row_rank, entry.optInt("rank", 0).toString())
            row.setTextViewText(R.id.widget_row_name, entry.optString("userName"))
            row.setTextViewText(R.id.widget_row_points, "${entry.optInt("points", 0)} XP")
            val streak = entry.optInt("dailyStreak", 0)
            row.setTextViewText(R.id.widget_row_streak, if (streak > 0) "🔥 $streak" else "")
            val color = context.getColor(if (isYou) R.color.habits_widget_accent else R.color.habits_widget_text)
            row.setTextColor(R.id.widget_row_rank, color)
            row.setTextColor(R.id.widget_row_name, color)
            return row
        }

        private fun tapIntent(context: Context, actionSuffix: String, requestCode: Int): PendingIntent {
            val intent = Intent(context, MainActivity::class.java).apply {
                action = "${context.packageName}.$actionSuffix"
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            return PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        private fun refreshAction(context: Context): String = "${context.packageName}.$ACTION_REFRESH"

        /** The freshness label's tap: a broadcast to this receiver, handled in [onReceive]. */
        private fun refreshIntent(context: Context): PendingIntent {
            val intent = Intent(context, HabitsWidgetProvider::class.java).apply {
                action = refreshAction(context)
            }
            return PendingIntent.getBroadcast(
                context,
                4,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
    }
}
