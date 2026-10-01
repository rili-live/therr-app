package app.therrmobile.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews
import app.therrmobile.R
import org.json.JSONObject
import java.util.Calendar
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

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
 * Two things follow the device's clock rather than the snapshot, so they are decided here at draw
 * time and move on the widget's own 30-minute redraw, app closed or not:
 *  - Day or night. The chameleon sits under a day sky from [DAY_STARTS_AT_HOUR] and under the
 *    night sky from [NIGHT_STARTS_AT_HOUR], local time.
 *  - The evening warning. From [AT_RISK_FROM_HOUR] until midnight a live streak shows as at risk
 *    — a red "!" on the flame and the warning on a red pill in place of the label — when the
 *    server says today is at stake (or, without its verdict, today is a due day for one of the
 *    user's habits) and no check-in has counted for it yet. See [isAtRisk].
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

        /** Local hour the day art takes over from the night art. */
        const val DAY_STARTS_AT_HOUR = 7

        /** Local hour the night art takes back over. */
        const val NIGHT_STARTS_AT_HOUR = 19

        /**
         * Local hour from which an unkept streak on a due day shows as at risk. An hour and a half
         * ahead of the server's evening "last chance" push (19:30 by default), so the home screen
         * says it before the phone buzzes about it.
         */
        const val AT_RISK_FROM_HOUR = 18

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

        internal fun isDaytime(hourOfDay: Int): Boolean = hourOfDay in DAY_STARTS_AT_HOUR until NIGHT_STARTS_AT_HOUR

        /** YYYY-MM-DD for [now] in the device's zone — the format JS writes `checkedInOn` in. */
        internal fun localDate(now: Calendar): String = String.format(
            Locale.US,
            "%04d-%02d-%02d",
            now.get(Calendar.YEAR),
            now.get(Calendar.MONTH) + 1,
            now.get(Calendar.DAY_OF_MONTH),
        )

        /**
         * Whether the streak shown should warn that it is about to be lost, at [now].
         *
         * Never without a streak to lose, never before evening, and never once the snapshot's
         * `streak.checkedInOn` is today — a check-in after the verdict below settles the day.
         * `checkedInOn` is a date, so yesterday's check-in stops counting at midnight without a
         * new snapshot.
         *
         * Then, in order:
         *  1. `streak.stake` dated today: the server's `isAtStakeToday`, which applies the daily
         *     streak's own required-day rule, so it knows when a weekly-count habit needs today and
         *     never warns on a rest day.
         *  2. Otherwise — no verdict yet (after midnight, before a refresh), or one from an older
         *     server — today must be in `streak.dueWeekdays` (0 = Sunday). That holds only daily
         *     and fixed-day habits: whether a weekly-count habit needs today depends on the rest
         *     of its week, so without the server such a habit never triggers the warning — a
         *     missed warning is cheaper than a false one. A snapshot from before these fields
         *     existed never warns either.
         */
        internal fun isAtRisk(snapshot: JSONObject, days: Int, now: Calendar): Boolean {
            if (days <= 0 || now.get(Calendar.HOUR_OF_DAY) < AT_RISK_FROM_HOUR) return false
            val streak = snapshot.optJSONObject("streak") ?: return false
            val today = localDate(now)
            val checkedInOn = if (streak.isNull("checkedInOn")) null else streak.optString("checkedInOn")
            if (checkedInOn == today) return false

            val stake = streak.optJSONObject("stake")
            if (stake != null && stake.optString("date") == today) {
                return stake.optBoolean("isAtStake", false)
            }

            val dueWeekdays = streak.optJSONArray("dueWeekdays") ?: return false
            val weekday = now.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY
            return (0 until dueWeekdays.length()).any { dueWeekdays.optInt(it, -1) == weekday }
        }

        private fun draw(context: Context, manager: AppWidgetManager, appWidgetId: Int, snapshot: JSONObject?) {
            val views = RemoteViews(context.packageName, R.layout.widget_habits_streak)
            val now = Calendar.getInstance()
            drawSky(views, isDaytime(now.get(Calendar.HOUR_OF_DAY)))

            if (snapshot == null) {
                val message = context.getString(
                    if (HabitsWidgetProvider.isRefreshing(context)) R.string.habits_widget_loading else R.string.habits_widget_empty,
                )
                views.setViewVisibility(R.id.widget_streak_count_row, View.GONE)
                drawLabel(context, views, message, isWarning = false)
                views.setContentDescription(R.id.widget_streak_root, message)
                views.setOnClickPendingIntent(
                    R.id.widget_streak_root,
                    HabitsWidgetProvider.tapIntent(context, HabitsWidgetProvider.ACTION_OPEN_APP, REQUEST_OPEN_APP),
                )
                manager.updateAppWidget(appWidgetId, views)
                return
            }

            val days = streakDays(snapshot)
            val streak = snapshot.optJSONObject("streak")
            val label = streak?.optString("label").orEmpty().ifEmpty {
                if (days > 0) {
                    context.resources.getQuantityString(R.plurals.habits_streak_widget_days, days)
                } else {
                    context.getString(R.string.habits_streak_widget_start)
                }
            }
            val isAtRisk = isAtRisk(snapshot, days, now)

            views.setViewVisibility(R.id.widget_streak_count_row, View.VISIBLE)
            views.setTextViewText(R.id.widget_streak_count, days.toString())
            if (isAtRisk) {
                val warning = streak?.optString("atRiskLabel").orEmpty()
                    .ifEmpty { context.getString(R.string.habits_streak_widget_at_risk) }
                drawLabel(context, views, warning, isWarning = true)
                // "75 day streak. Check in to save your streak"
                views.setContentDescription(R.id.widget_streak_root, "$days $label. $warning")
            } else {
                drawLabel(context, views, label, isWarning = false)
                // "75 day streak" / "75 días seguidos"; at zero the label already says it all.
                views.setContentDescription(R.id.widget_streak_root, if (days > 0) "$days $label" else label)
            }
            views.setOnClickPendingIntent(
                R.id.widget_streak_root,
                HabitsWidgetProvider.tapIntent(context, HabitsWidgetProvider.ACTION_OPEN_TODAY, REQUEST_OPEN_TODAY),
            )
            manager.updateAppWidget(appWidgetId, views)
        }

        /** The art and the card behind it, by time of day. */
        private fun drawSky(views: RemoteViews, isDay: Boolean) {
            views.setImageViewResource(
                R.id.widget_streak_art,
                if (isDay) R.drawable.habits_streak_widget_art_day else R.drawable.habits_streak_widget_art,
            )
            views.setInt(
                R.id.widget_streak_root,
                "setBackgroundResource",
                if (isDay) R.drawable.habits_streak_widget_background_day else R.drawable.habits_streak_widget_background,
            )
        }

        /**
         * The line under the count. Every property is set both ways, not only for the warning: a
         * launcher can re-apply a new RemoteViews onto the views it already shows, so a pill left
         * from the evening would otherwise survive into the morning. Same for the badge above.
         */
        private fun drawLabel(context: Context, views: RemoteViews, text: String, isWarning: Boolean) {
            views.setViewVisibility(R.id.widget_streak_badge, if (isWarning) View.VISIBLE else View.GONE)
            views.setTextViewText(R.id.widget_streak_label, text)
            views.setInt(
                R.id.widget_streak_label,
                "setBackgroundResource",
                if (isWarning) R.drawable.habits_streak_widget_at_risk_pill else 0,
            )
            views.setTextColor(
                R.id.widget_streak_label,
                context.getColor(if (isWarning) R.color.habits_widget_text else R.color.habits_streak_widget_label),
            )
            val density = context.resources.displayMetrics.density
            val horizontal = if (isWarning) (8 * density).roundToInt() else 0
            val vertical = if (isWarning) (3 * density).roundToInt() else 0
            views.setViewPadding(R.id.widget_streak_label, horizontal, vertical, horizontal, vertical)
        }
    }
}
