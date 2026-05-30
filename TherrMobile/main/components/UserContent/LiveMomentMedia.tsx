import React, { useState } from 'react';
import {
    ActivityIndicator,
    ImageResizeMode,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Video from 'react-native-video';
import { Image } from '../BaseImage';
import { getUserVideoUri } from '../../utilities/content';
import { ITherrThemeColors } from '../../styles/themes';

interface IMediaEntry {
    type?: string;
    path?: string;
    [key: string]: any;
}

interface ILiveMomentMediaProps {
    // Resolved URI for the still image (poster / fallback).
    stillUri: string;
    // The paired video media entry, when this is a Live Moment.
    videoMedia?: IMediaEntry;
    // Whether the clip should be playing (settled + visible in feed, or on ViewMoment).
    isActive: boolean;
    // User opt-in: autoplay clips in the feed. ViewMoment passes true directly.
    isPlaybackEnabled: boolean;
    width: number;
    height: number;
    resizeMode?: ImageResizeMode;
    theme: { colors: ITherrThemeColors; styles: any };
}

/**
 * Renders a moment's media. For Live Moments (a still paired with a short muted clip) the
 * still acts as the poster and a looping, muted video overlays it only while `isActive` and
 * playback is enabled — so at most one clip plays at a time and scroll performance is
 * preserved. Falls back to the still for image-only moments. See docs/LIVE_MOMENTS_PLAN.md.
 */
const LiveMomentMedia = ({
    stillUri,
    videoMedia,
    isActive,
    isPlaybackEnabled,
    width,
    height,
    resizeMode = 'contain',
    theme,
}: ILiveMomentMediaProps) => {
    const [isVideoReady, setIsVideoReady] = useState(false);

    const shouldPlay = !!videoMedia && isActive && isPlaybackEnabled;
    const videoUri = videoMedia ? getUserVideoUri(videoMedia, height, width) : undefined;

    return (
        <View style={{ width, height }}>
            {/* Still poster: always rendered so first paint is instant and we degrade
                gracefully when the clip is absent or not yet buffered. */}
            <Image
                source={{ uri: stillUri }}
                style={{ width, height }}
                resizeMode={resizeMode}
                PlaceholderContent={<ActivityIndicator color={theme.colors.brandingBlueGreen} />}
            />
            {shouldPlay && videoUri && (
                <Video
                    source={{ uri: videoUri }}
                    style={[StyleSheet.absoluteFill, { opacity: isVideoReady ? 1 : 0 }]}
                    resizeMode={resizeMode === 'cover' ? 'cover' : 'contain'}
                    repeat
                    muted
                    paused={!shouldPlay}
                    playWhenInactive={false}
                    playInBackground={false}
                    disableFocus
                    ignoreSilentSwitch="ignore"
                    onReadyForDisplay={() => setIsVideoReady(true)}
                    onError={() => setIsVideoReady(false)}
                />
            )}
            {!!videoMedia && (
                <View style={[localStyles.liveBadge, { backgroundColor: theme.colors.brandingBlack }]}>
                    <View style={[localStyles.liveDot, { backgroundColor: theme.colors.brandingWhite }]} />
                    <Text style={[localStyles.liveBadgeText, { color: theme.colors.brandingWhite }]}>LIVE</Text>
                </View>
            )}
        </View>
    );
};

const localStyles = StyleSheet.create({
    liveBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        opacity: 0.85,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 5,
    },
    liveBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});

export default LiveMomentMedia;
