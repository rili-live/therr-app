enum HabitGoalTypes {
    BUILD_GOOD = 'build_good',
    BREAK_BAD = 'break_bad',
    SAVINGS_GOAL = 'savings_goal',
    MAINTENANCE = 'maintenance',
}

// Literal union derived from the enum so DB columns / wire payloads can be
// typed without re-declaring the strings. Update both at once if values change.
type HabitGoalType = `${HabitGoalTypes}`;

export {
    HabitGoalTypes,
    HabitGoalType,
};
