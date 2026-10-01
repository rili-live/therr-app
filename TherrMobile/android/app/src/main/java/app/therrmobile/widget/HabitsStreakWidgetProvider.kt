package app.therrmobile.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews
import app.therrmobile.R
import org.json.JSONObject
import kotlin.math.max

/**
 * Friends with Habits streak widget: the user's app-level daily streak over the chameleon, and
 * nothing else — the small companion to the leaderboard widget, in the shape of Duolingo's.
 *
 * It owns no data. It draws the snapshot the leaderboard widget already keeps (written by
 * HabitsWidgetModule from main/utilities/habitsWidget.ts), and asks for fresh data through
 * [HabitsWidgetProvider.requestRefresh], which counts this widget among the placed ones. So the
 * same background refresh keeps both current, and every publish redraws both.
 *
 * The count is the snapshot's `streak.days`, with `streak.label` beside it, both written by JS
 * so the label follows the in-app locale and plural. A snapshot from before the streak block
 * existed has neither; the count then comes from the boards' own `you.dailyStreak` and the label
 * from this app's string resources, until the next publish replaces it.
 *
 * A tap opens the dashboard's habits tab, where a check-in keeps the streak alive, or just the
 * app when there is no snapshot yet.
 */
class HabitsStreakWidgetProvider : AppWidgetProvider() {

    override fun onEnabled(context: Context) {
        HabitsWidgetProvider.requestRefresh(context, HabitsWidgetRefreshWorker.REASON_PLACED)
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        // Ask first so a placement with no snapshot already reads "Loading…".
        HabitsWidgetProvider.requestRefresh(context, HabitsWidgetRefreshWorker.REASON_PERIODIC)
        val snapshot = HabitsWidgetProvider.readSnapshot(context)
        appWidgetIds.forEach { id -> draw(context, appWidgetManager, id, snapshot) }
    }

    companion object {
        // Distinct from the leaderboard widget's codes, though an equal intent would be harmless.
        private const val REQUEST_OPEN_APP = 10
        private const val REQUEST_OPEN_TODAY = 11

        private fun widgetIds(context: Context): IntArray =
            AppWidgetManager.getInstance(context)
                .getAppWidgetIds(ComponentName(context, HabitsStreakWidgetProvider::class.java))

        fun hasWidgets(context: Context): Boolean = widgetIds(context).isNotEmpty()

        /** Redraw every placed streak widget from the stored snapshot. */
        fun drawAll(context: Context) {
            val ids = widgetIds(context)
            if (ids.isEmpty()) return
            val manager = AppWidgetManager.getInstance(context)
            val snapshot = HabitsWidgetProvider.readSnapshot(context)
            ids.forEach { id -> draw(context, manager, id, snapshot) }
        }

        /**
         * The daily streak in [snapshot]: its `streak` block, or for an older snapshot the
         * boards' `you.dailyStreak` (the same number on both), or the pre-toggle single board's.
         */
        internal fun streakDays(snapshot: JSONObject): Int {
            snapshot.optJSONObject("streak")?.let { return max(0, it.optInt("days", 0)) }
            val boards = snapshot.optJSONObject("boards")
            val fromBoards = listOf("connections", "global").maxOfOrNull { scope ->
                boards?.optJSONObject(scope)?.optJSONObject("you")?.optInt("dailyStreak", 0) ?: 0
            } ?: 0
            val legacy = snapshot.optJSONObject("you")?.optInt("dailyStreak", 0) ?: 0
            return max(0, max(fromBoards, legacy))
        }

        private fun draw(context: Context, manager: AppWidgetManager, appWidgetId: Int, snapshot: JSONObject?) {
            val views = RemoteViews(context.packageName, R.layout.widget_habits_streak)

            if (snapshot == null) {
                val message = context.getString(
                    if (HabitsWidgetProvider.isRefreshing(context)) R.string.habits_widget_loading else R.string.habits_widget_empty,
                )
                views.setViewVisibility(R.id.widget_streak_count_row, View.GONE)
                views.setTextViewText(R.id.widget_streak_label, message)
                views.setContentDescription(R.id.widget_streak_root, message)
                views.setOnClickPendingIntent(
                    R.id.widget_streak_root,
                    HabitsWidgetProvider.tapIntent(context, HabitsWidgetProvider.ACTION_OPEN_APP, REQUEST_OPEN_APP),
                )
                manager.updateAppWidget(appWidgetId, views)
                return
            }

            val days = streakDays(snapshot)
            val label = snapshot.optJSONObject("streak")?.optString("label").orEmpty().ifEmpty {
                if (days > 0) {
                    context.resources.getQuantityString(R.plurals.habits_streak_widget_days, days)
                } else {
                    context.getString(R.string.habits_streak_widget_start)
                }
            }

            views.setViewVisibility(R.id.widget_streak_count_row, View.VISIBLE)
            views.setTextViewText(R.id.widget_streak_count, days.toString())
            views.setTextViewText(R.id.widget_streak_label, label)
            // "75 day streak" / "75 días seguidos"; at zero the label already says it all.
            views.setContentDescription(R.id.widget_streak_root, if (days > 0) "$days $label" else label)
            views.setOnClickPendingIntent(
                R.id.widget_streak_root,
                HabitsWidgetProvider.tapIntent(context, HabitsWidgetProvider.ACTION_OPEN_TODAY, REQUEST_OPEN_TODAY),
            )
            manager.updateAppWidget(appWidgetId, views)
        }
    }
}
