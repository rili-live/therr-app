import React from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { ITherrThemeColors } from '../../styles/themes';
import TherrIcon from '../TherrIcon';

interface IAreaCreatePromptCardProps {
    cardWidth: number;
    cardHeight: number;
    /** Title of the nearest space, when there is one to name. */
    nearestSpaceTitle?: string;
    onPress: () => any;
    theme: {
        styles: any;
        colors: ITherrThemeColors;
    };
    themeViewArea: {
        styles: any;
    };
    translate: Function;
}

/**
 * The last card in the map preview strip, and the only card when nothing is nearby.
 *
 * Two jobs. It keeps a creation CTA in the same scroll the user is already reading, and
 * it replaces the old empty state — previously an empty result simply refused to open the
 * strip, so a user in a quiet area saw nothing at all and had no idea the app wanted a
 * post from them. Naming the nearest space turns a blank composer into a specific ask.
 */
const AreaCreatePromptCard = ({
    cardWidth,
    cardHeight,
    nearestSpaceTitle,
    onPress,
    theme,
    themeViewArea,
    translate,
}: IAreaCreatePromptCardProps) => (
    <View style={[themeViewArea.styles.cardContainer, { height: cardHeight, width: cardWidth }]}>
        <Pressable
            onPress={onPress}
            style={[
                themeViewArea.styles.card,
                localStyles.promptCard,
                { borderColor: theme.colors.accentAlt },
            ]}
        >
            <TherrIcon
                name="map-marker-plus"
                size={28}
                color={theme.colors.accentAlt}
            />
            <Text numberOfLines={2} style={[themeViewArea.styles.cardTitle, localStyles.promptTitle]}>
                {nearestSpaceTitle
                    ? translate('pages.map.preview.createPromptTitleAtSpace', { spaceTitle: nearestSpaceTitle })
                    : translate('pages.map.preview.createPromptTitle')}
            </Text>
            <Text numberOfLines={2} style={[themeViewArea.styles.cardDescription, localStyles.promptSubtitle]}>
                {translate('pages.map.preview.createPromptSubtitle')}
            </Text>
        </Pressable>
    </View>
);

const localStyles = StyleSheet.create({
    promptCard: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderStyle: 'dashed',
        paddingHorizontal: 10,
        gap: 4,
    },
    promptTitle: {
        textAlign: 'center',
    },
    promptSubtitle: {
        textAlign: 'center',
    },
});

export default AreaCreatePromptCard;
