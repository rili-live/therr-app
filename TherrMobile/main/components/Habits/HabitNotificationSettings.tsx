import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Switch } from 'react-native-paper';
import {
    IUserHabit,
    UserHabitNotificationCategory,
    USER_HABIT_NOTIFICATION_CATEGORIES,
    getUserHabitNotificationPreferences,
} from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';

/**
 * Per-habit notification switches.
 *
 * ## Why this is per habit and not one more row on Settings
 *
 * The account-wide toggles on ManageNotifications are all-or-nothing across every
 * habit someone tracks. Somebody who wants their morning reminder but not
 * "your partner missed a day — send them a nudge?" had exactly one available
 * answer: turn habits notifications off. Turning the app off is the outcome these
 * switches exist to prevent, so they live next to the one habit they govern.
 *
 * ## Absent means On
 *
 * All four columns are NOT NULL DEFAULT true server-side, so an absent value means
 * the response predates them — not that the user opted out. `getUserHabitNotificationPreferences`
 * applies that rule; this component must never re-derive it. Rendering an absent
 * value as Off would tell the user their reminders are disabled while they keep
 * arriving, and the first toggle would then write the `false` the screen invented
 * and make the lie true. That exact trap is documented for the account-wide
 * columns in `routes/Settings/pushPreferences.ts`.
 *
 * ## Optimistic, but only per row
 *
 * A switch flips immediately and reverts if the write fails, because a switch that
 * waits on a round trip reads as broken. The pending row is tracked individually
 * rather than with one screen-level flag so toggling one category does not freeze
 * the other three.
 */

interface IHabitNotificationSettingsProps {
    /** The tracking row. Absent while the habits list is still loading. */
    userHabit?: IUserHabit;
    /**
     * Resolves when the write lands, rejects when it fails — the component reverts
     * the optimistic flip on a rejection, so a caller that swallows the error
     * leaves the switch showing a value the server does not hold.
     */
    onChange: (category: UserHabitNotificationCategory, nextValue: boolean) => Promise<any>;
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
    translate: (key: string, params?: any) => string;
}

interface IHabitNotificationSettingsState {
    /**
     * Optimistic overrides, by category. Cleared per row once the write settles,
     * so the rendered value falls back to whatever the store now holds rather than
     * to a stale local copy.
     */
    pendingValues: Partial<Record<UserHabitNotificationCategory, boolean>>;
    savingCategories: UserHabitNotificationCategory[];
}

class HabitNotificationSettings extends React.Component<
    IHabitNotificationSettingsProps,
    IHabitNotificationSettingsState
> {
    /**
     * The write outlives the screen: a user can flip a switch and immediately
     * swipe back, and the settle below would then set state on a torn-down tree.
     */
    private isUnmounted = false;

    constructor(props: IHabitNotificationSettingsProps) {
        super(props);

        this.state = {
            pendingValues: {},
            savingCategories: [],
        };
    }

    componentWillUnmount() {
        this.isUnmounted = true;
    }

    handleToggle = (category: UserHabitNotificationCategory, currentValue: boolean) => {
        const { onChange } = this.props;
        const nextValue = !currentValue;

        this.setState((prev) => ({
            pendingValues: { ...prev.pendingValues, [category]: nextValue },
            savingCategories: [...prev.savingCategories, category],
        }));

        const settle = (keepOverride: boolean) => {
            if (this.isUnmounted) {
                return;
            }
            this.setState((prev) => {
                const pendingValues = { ...prev.pendingValues };
                if (!keepOverride) {
                    delete pendingValues[category];
                }
                return {
                    pendingValues,
                    savingCategories: prev.savingCategories.filter((c) => c !== category),
                };
            });
        };

        return onChange(category, nextValue)
            // Drop the override on success: the store now holds the new value, and
            // keeping a local copy would shadow anything a later refresh brings in.
            .then(() => settle(false))
            .catch(() => settle(false));
    };

    render() {
        const { userHabit, themeHabits, translate } = this.props;
        const { pendingValues, savingCategories } = this.state;

        if (!userHabit) {
            return null;
        }

        const stored = getUserHabitNotificationPreferences(userHabit);

        return (
            <View style={themeHabits.styles.streakWidgetContainer}>
                <Text style={themeHabits.styles.dashboardSectionTitle}>
                    {translate('pages.habits.notificationPrefs.title')}
                </Text>
                {/*
                  * The rule, before the switches. Someone turning one off is deciding
                  * how much the app may interrupt them, and the useful fact is that
                  * this is scoped to one habit — the others keep their own settings.
                  */}
                <Text style={themeHabits.styles.habitNotificationPrefsCaption}>
                    {translate('pages.habits.notificationPrefs.description', {
                        habitName: userHabit.goalName,
                    })}
                </Text>

                {USER_HABIT_NOTIFICATION_CATEGORIES.map((category) => {
                    const value = pendingValues[category] ?? stored[category];
                    const isSaving = savingCategories.includes(category);

                    return (
                        <View key={category} style={themeHabits.styles.habitNotificationPrefsRow}>
                            <View style={themeHabits.styles.habitNotificationPrefsLabelContainer}>
                                <Text style={themeHabits.styles.habitNotificationPrefsLabel}>
                                    {translate(`pages.habits.notificationPrefs.${category}.label`)}
                                </Text>
                                <Text style={themeHabits.styles.habitNotificationPrefsHint}>
                                    {translate(`pages.habits.notificationPrefs.${category}.hint`)}
                                </Text>
                            </View>
                            {isSaving ? (
                                <ActivityIndicator
                                    color={themeHabits.colors.primary3}
                                    style={themeHabits.styles.habitNotificationPrefsSpinner}
                                />
                            ) : (
                                <Switch
                                    accessibilityLabel={
                                        translate(`pages.habits.notificationPrefs.${category}.label`)
                                    }
                                    color={themeHabits.colors.primary3}
                                    value={value}
                                    onValueChange={() => this.handleToggle(category, value)}
                                />
                            )}
                        </View>
                    );
                })}

                {/*
                  * The one thing a per-habit screen cannot say for itself: these only
                  * ever narrow. Turning one on here does nothing while the account-wide
                  * switch — or the OS — has habits pushes off, and a user who does not
                  * know that reads the dead switch as a bug.
                  */}
                <Text style={themeHabits.styles.habitNotificationPrefsFootnote}>
                    {translate('pages.habits.notificationPrefs.accountWideNote')}
                </Text>
            </View>
        );
    }
}

export default HabitNotificationSettings;
