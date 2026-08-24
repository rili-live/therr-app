import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Image } from '../BaseImage';
import TherrIcon from '../TherrIcon';
import BrandedMediaPlaceholder from './BrandedMediaPlaceholder';
import { ITherrThemeColors } from '../../styles/themes';

/**
 * The card rendered inside every area-detail rail (`HorizontalCardScroller`).
 *
 * Purposefully generic: pairings, upcoming events and guest posts differ only
 * in which meta lines they populate and what they hang off the footer, so they
 * share one card rather than three near-identical ones that drift apart.
 */

const CARD_BORDER_RADIUS = 14;
const MEDIA_ASPECT_RATIO = 0.62;
const AVATAR_SIZE = 26;

export interface IAreaScrollerCardAvatar {
    uri: string;
    key: string;
}

interface IAreaScrollerCardProps {
    width: number;
    /** Stable id used to seed the branded placeholder when there is no media. */
    seed?: string;
    imageUri?: string;
    category?: string;
    areaType?: string;
    title: string;
    /** Small pill above the title, e.g. the space category. */
    badgeLabel?: string;
    /** Ordered meta lines under the title. Falsy entries are skipped. */
    metaLines?: (string | null | undefined | false)[];
    rating?: number;
    ratingCount?: number;
    avatars?: IAreaScrollerCardAvatar[];
    footerLabel?: string;
    /** Rendered in place of the avatar/label footer when supplied. */
    footerContent?: React.ReactNode;
    onPress: () => void;
    onSharePress?: () => void;
    onSavePress?: () => void;
    isSaved?: boolean;
    isDarkMode: boolean;
    accessibilityLabel?: string;
    shareAccessibilityLabel?: string;
    saveAccessibilityLabel?: string;
    theme: {
        styles: any;
        colors: ITherrThemeColors;
    };
}

const AreaScrollerCard = ({
    width,
    seed,
    imageUri,
    category,
    areaType,
    title,
    badgeLabel,
    metaLines,
    rating,
    ratingCount,
    avatars,
    footerLabel,
    footerContent,
    onPress,
    onSharePress,
    onSavePress,
    isSaved,
    isDarkMode,
    accessibilityLabel,
    shareAccessibilityLabel,
    saveAccessibilityLabel,
    theme,
}: IAreaScrollerCardProps) => {
    const mediaHeight = Math.round(width * MEDIA_ASPECT_RATIO);
    const titleColor = isDarkMode ? theme.colors.textWhite : theme.colors.textDark;
    const visibleMetaLines = (metaLines || []).filter(Boolean) as string[];
    const hasOverlayActions = !!onSharePress || !!onSavePress;

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                localStyles.card,
                { width },
                pressed ? localStyles.cardPressed : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || title}
        >
            <View style={[localStyles.mediaContainer, { width, height: mediaHeight }]}>
                {imageUri ? (
                    <Image
                        source={{ uri: imageUri }}
                        style={localStyles.media}
                        width={width}
                        height={mediaHeight}
                        resizeMode="cover"
                        PlaceholderContent={<ActivityIndicator size="small" color={theme.colors.brand} />}
                        transition={false}
                    />
                ) : (
                    <BrandedMediaPlaceholder
                        seed={seed}
                        category={category}
                        areaType={areaType}
                        width={width}
                        height={mediaHeight}
                        theme={theme}
                    />
                )}
                {hasOverlayActions && (
                    <View style={localStyles.overlayRow}>
                        {!!onSharePress && (
                            <Pressable
                                onPress={onSharePress}
                                hitSlop={8}
                                style={localStyles.overlayButton}
                                accessibilityRole="button"
                                accessibilityLabel={shareAccessibilityLabel}
                            >
                                <TherrIcon name="share" size={16} color={theme.colors.brandingWhite} />
                            </Pressable>
                        )}
                        {!!onSavePress && (
                            <Pressable
                                onPress={onSavePress}
                                hitSlop={8}
                                style={localStyles.overlayButton}
                                accessibilityRole="button"
                                accessibilityLabel={saveAccessibilityLabel}
                            >
                                <TherrIcon
                                    name={isSaved ? 'heart-filled' : 'heart'}
                                    size={16}
                                    color={isSaved ? theme.colors.accentRed : theme.colors.brandingWhite}
                                />
                            </Pressable>
                        )}
                    </View>
                )}
            </View>

            <View style={localStyles.body}>
                {!!badgeLabel && (
                    <View style={[localStyles.badge, { backgroundColor: theme.colors.brand }]}>
                        <Text
                            style={[localStyles.badgeText, { color: theme.colors.brandingWhite }]}
                            numberOfLines={1}
                        >
                            {badgeLabel}
                        </Text>
                    </View>
                )}
                <Text style={[localStyles.title, { color: titleColor }]} numberOfLines={2}>
                    {title}
                </Text>
                {visibleMetaLines.map((line, index) => (
                    <Text
                        // Two meta lines can legitimately carry the same text (an
                        // event that starts and ends at the same time), so the
                        // position has to be part of the key.
                        key={`${index}-${line}`}
                        style={[localStyles.metaText, { color: theme.colors.textGray }]}
                        numberOfLines={1}
                    >
                        {line}
                    </Text>
                ))}
                {rating != null && (
                    <View style={localStyles.ratingRow}>
                        <Text style={[localStyles.metaText, { color: theme.colors.textGray }]}>
                            {rating}
                        </Text>
                        <TherrIcon
                            name="star-filled"
                            size={12}
                            color={theme.colors.accentYellow}
                            style={localStyles.ratingIcon}
                        />
                        {ratingCount != null && (
                            <Text style={[localStyles.metaText, { color: theme.colors.textGray }]}>
                                {`(${ratingCount})`}
                            </Text>
                        )}
                    </View>
                )}
                {footerContent || ((avatars?.length || footerLabel) ? (
                    <View style={localStyles.footerRow}>
                        {avatars?.map((avatar, index) => (
                            <Image
                                key={avatar.key}
                                source={{ uri: avatar.uri }}
                                style={[
                                    localStyles.avatar,
                                    { borderColor: theme.colors.surface },
                                    index > 0 ? localStyles.avatarOverlap : null,
                                ]}
                                width={AVATAR_SIZE}
                                height={AVATAR_SIZE}
                                resizeMode="cover"
                                transition={false}
                            />
                        ))}
                        {!!footerLabel && (
                            <Text
                                style={[
                                    localStyles.footerLabel,
                                    { color: theme.colors.textGray },
                                    avatars?.length ? localStyles.footerLabelSpaced : null,
                                ]}
                                numberOfLines={1}
                            >
                                {footerLabel}
                            </Text>
                        )}
                    </View>
                ) : null)}
            </View>
        </Pressable>
    );
};

const localStyles = StyleSheet.create({
    card: {
        borderRadius: CARD_BORDER_RADIUS,
    },
    cardPressed: {
        opacity: 0.8,
    },
    mediaContainer: {
        borderRadius: CARD_BORDER_RADIUS,
        overflow: 'hidden',
    },
    media: {
        borderRadius: CARD_BORDER_RADIUS,
    },
    overlayRow: {
        position: 'absolute',
        top: 8,
        right: 8,
        flexDirection: 'row',
        gap: 8,
    },
    overlayButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.42)',
    },
    body: {
        paddingTop: 8,
    },
    badge: {
        alignSelf: 'flex-start',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginBottom: 4,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 21,
    },
    metaText: {
        fontSize: 13,
        marginTop: 2,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    ratingIcon: {
        marginHorizontal: 3,
    },
    footerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    avatar: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        borderWidth: 1.5,
    },
    avatarOverlap: {
        marginLeft: -10,
    },
    footerLabel: {
        fontSize: 13,
        flexShrink: 1,
    },
    footerLabelSpaced: {
        marginLeft: 8,
    },
});

export default AreaScrollerCard;
