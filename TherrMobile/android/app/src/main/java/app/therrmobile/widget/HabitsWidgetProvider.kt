package app.therrmobile.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
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
 * main/utilities/habitsWidget.ts) and this provider draws it — no network, no auth token.
 * `updatePeriodMillis` redraws periodically so the reset countdown moves and a week that has
 * rolled over stops showing last week's rank, all from the stored snapshot.
 *
 * Taps are explicit intents to MainActivity carrying a `<package>.WIDGET_*` action. The
 * existing shortcut plumbing delivers them to JS: onNewIntent emits "new-intent-action" on a
 * warm start, and InitialIntentModule hands the launch action to Layout on a cold start.
 */
class HabitsWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
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

    companion object {
        const val PREFS_NAME = "habits_widget"
        const val KEY_SNAPSHOT = "snapshot"

        private const val ACTION_OPEN_APP = "WIDGET_OPEN_APP"
        private const val ACTION_OPEN_LEADERBOARD = "WIDGET_OPEN_LEADERBOARD"
        private const val ACTION_OPEN_LEADERBOARD_GLOBAL = "WIDGET_OPEN_LEADERBOARD_GLOBAL"
        private const val ACTION_OPEN_TODAY = "WIDGET_OPEN_TODAY"
        private const val ACTION_INVITE_FRIENDS = "WIDGET_INVITE_FRIENDS"

        private const val DAY_MS = 24L * 60 * 60 * 1000

        /** Redraw every placed widget from the stored snapshot. */
        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, HabitsWidgetProvider::class.java))
            if (ids.isEmpty()) return
            val snapshot = readSnapshot(context)
            ids.forEach { id -> draw(context, manager, id, snapshot) }
        }

        private fun readSnapshot(context: Context): JSONObject? {
            val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString(KEY_SNAPSHOT, null) ?: return null
            return runCatching { JSONObject(raw) }.getOrNull()
        }

        private fun rowsForHeight(minHeightDp: Int): Int = when {
            minHeightDp <= 0 -> 1
            minHeightDp < 150 -> 1
            minHeightDp < 190 -> 2
            else -> 3
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

        private fun draw(context: Context, manager: AppWidgetManager, appWidgetId: Int, snapshot: JSONObject?) {
            val views = RemoteViews(context.packageName, R.layout.widget_habits)

            if (snapshot == null) {
                views.setViewVisibility(R.id.widget_content, View.GONE)
                views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
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
            val now = System.currentTimeMillis()
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
            views.setOnClickPendingIntent(R.id.widget_header, leaderboardTap)
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
                val maxRows = rowsForHeight(
                    manager.getAppWidgetOptions(appWidgetId).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0),
                )
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
    }
}
