import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ChameleonLoader from '../Loaders/ChameleonLoader';
import { ITherrThemeColors } from '../../styles/themes';
import { therrFontFamily } from '../../styles/font';
import { fontSizes } from '../../styles/text';
import { space } from '../../styles/layouts/spacing';

interface IHabitsListLoaderProps {
    /** Line under the mascot. Omit where the surrounding screen already names what is loading. */
    label?: string;
    size?: number;
    /**
     * Any of the habits theme objects (`styles/habits`, `styles/habits/journal`, …) — only
     * `colors` is read, which every one of them spreads from the active theme.
     */
    theme: {
        colors: ITherrThemeColors;
    };
    testID?: string;
}

/**
 * Stands in for a list's empty state until its first fetch resolves.
 *
 * `ListEmptyComponent` fires the moment `data` is empty, and until that first fetch settles
 * "empty" is indistinguishable from "not loaded yet" — so a returning user with a dozen habits
 * was greeted by the onboarding empty state ("No habits yet", Create button and all) for the
 * length of the request, which then vanished and was replaced by their real list. A list that
 * has not loaded is not an empty list, and the two must not look alike.
 *
 * Uses the chameleon rather than a bare `ActivityIndicator` so the wait is the app's own,
 * matching every other full-screen load in Friends with Habits (see `LottieLoader`).
 *
 * Layout lives here rather than in a theme stylesheet because the call sites carry different
 * theme objects (the dashboard's `themeHabits`, the journal's `themeJournal`) and only the
 * label's colour actually varies.
 */
const HabitsListLoader = ({
    label,
    size = 84,
    theme,
    testID = 'habits-list-loader',
}: IHabitsListLoaderProps) => (
    <View style={localStyles.container} testID={testID}>
        <ChameleonLoader size={size} theme={theme} />
        {!!label && (
            <Text style={[localStyles.label, { color: theme.colors.onSurfaceMuted }]}>
                {label}
            </Text>
        )}
    </View>
);

const localStyles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: space.xl,
        paddingHorizontal: space.lg,
    },
    label: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.sm,
        marginTop: space.sm,
        textAlign: 'center',
    },
});

export default HabitsListLoader;
