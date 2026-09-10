import React, { useCallback } from 'react';
import {
    ActivityIndicator,
    FlatList,
    ListRenderItemInfo,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { ITherrThemeColors } from '../../styles/themes';

/**
 * Section wrapper for the horizontally-paging card rails used throughout the
 * area detail screens (Local Pairings, Upcoming Events, Guest Posts).
 *
 * These sections used to stack full-width cards vertically, which pushed the
 * primary content off-screen as soon as a space had more than a couple of
 * related items. A rail keeps each section to a fixed height regardless of how
 * many items come back, and the partially-visible next card is what tells the
 * user the list continues.
 */

export const SCROLLER_EDGE_INSET = 16;
export const SCROLLER_CARD_GAP = 12;

/**
 * Cards intentionally stop short of the viewport width so the next one peeks in
 * — that peek is the affordance. Clamped so the rail still looks right on both
 * a small phone and a tablet.
 */
export const getScrollerCardWidth = (viewportWidth: number): number =>
    Math.round(Math.min(300, Math.max(210, viewportWidth * 0.72)));

interface IHorizontalCardScrollerProps {
    title?: string;
    description?: string;
    data: any[];
    renderCard: (info: ListRenderItemInfo<any>) => React.ReactElement | null;
    keyExtractor: (item: any, index: number) => string;
    itemWidth: number;
    gap?: number;
    edgeInset?: number;
    isLoading?: boolean;
    theme: {
        styles: any;
        colors: ITherrThemeColors;
    };
    testID?: string;
}

const HorizontalCardScroller = ({
    title,
    description,
    data,
    renderCard,
    keyExtractor,
    itemWidth,
    gap = SCROLLER_CARD_GAP,
    edgeInset = SCROLLER_EDGE_INSET,
    isLoading,
    theme,
    testID,
}: IHorizontalCardScrollerProps) => {
    const snapInterval = itemWidth + gap;

    // Supplied so the rail can jump straight to an offset without measuring —
    // every card in a rail is the same fixed width, so the layout is known.
    const getItemLayout = useCallback((_data: any, index: number) => ({
        length: snapInterval,
        offset: snapInterval * index,
        index,
    }), [snapInterval]);

    const renderSeparator = useCallback(() => <View style={{ width: gap }} />, [gap]);

    const header = (
        <View style={[localStyles.header, { paddingHorizontal: edgeInset }]}>
            {!!title && (
                <Text style={[theme.styles.sectionTitleSmall, localStyles.title]}>
                    {title}
                </Text>
            )}
            {!!description && (
                <Text style={[localStyles.description, { color: theme.colors.textGray }]}>
                    {description}
                </Text>
            )}
        </View>
    );

    if (isLoading) {
        return (
            <View style={localStyles.section} testID={testID}>
                {header}
                <ActivityIndicator size="small" color={theme.colors.brand} style={localStyles.loader} />
            </View>
        );
    }

    if (!data?.length) {
        return null;
    }

    return (
        <View style={localStyles.section} testID={testID}>
            {header}
            <FlatList
                horizontal
                data={data}
                renderItem={renderCard}
                keyExtractor={keyExtractor}
                getItemLayout={getItemLayout}
                ItemSeparatorComponent={renderSeparator}
                contentContainerStyle={{ paddingHorizontal: edgeInset }}
                showsHorizontalScrollIndicator={false}
                snapToInterval={snapInterval}
                snapToAlignment="start"
                decelerationRate="fast"
                disableIntervalMomentum
                initialNumToRender={2}
                windowSize={5}
                removeClippedSubviews={false}
            />
        </View>
    );
};

const localStyles = StyleSheet.create({
    section: {
        width: '100%',
        paddingVertical: 12,
    },
    header: {
        marginBottom: 10,
    },
    title: {
        marginBottom: 2,
    },
    description: {
        fontSize: 13,
        lineHeight: 18,
    },
    loader: {
        marginVertical: 20,
    },
});

export default HorizontalCardScroller;
