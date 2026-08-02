import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { IUserState } from 'therr-react/types';
import { buildStyles } from '../styles/profileCompletionLink';
import useProfileCompletion from '../hooks/useProfileCompletion';

interface IProfileCompletionLinkProps {
    navigation: any;
    translate: (key: string, params?: any) => string;
    user: IUserState;
    themeName?: string;
}

/**
 * Single-row "Finish your profile" entry point on the user's own profile. The
 * checklist itself lives on the dedicated ProfileCompletion screen — this only
 * summarizes what is left and links there, so the profile stays scannable.
 * Renders nothing once every step is resolved.
 */
const ProfileCompletionLink: React.FC<IProfileCompletionLinkProps> = ({
    navigation,
    translate,
    user,
    themeName,
}) => {
    const theme = useMemo(() => buildStyles(themeName as any), [themeName]);
    const { isReady, summary } = useProfileCompletion(user, navigation);

    if (!isReady || summary.isComplete) {
        return null;
    }

    const title = translate('components.profileCompletionLink.title');
    const stepsLeft = translate(
        summary.remainingCount === 1
            ? 'components.profileCompletionLink.stepLeft'
            : 'components.profileCompletionLink.stepsLeft',
        { count: summary.remainingCount },
    );

    return (
        <Pressable
            style={theme.styles.container}
            onPress={() => navigation.navigate('ProfileCompletion')}
            accessibilityRole="button"
            accessibilityLabel={`${title} ${stepsLeft}`}
        >
            <View style={theme.styles.iconContainer}>
                <FontAwesomeIcon
                    name="user-check"
                    size={16}
                    style={theme.styles.icon}
                />
            </View>
            <View style={theme.styles.textContainer}>
                <Text style={theme.styles.title}>{title}</Text>
                <Text style={theme.styles.stepsLeft}>{stepsLeft}</Text>
                <View style={theme.styles.progressTrack}>
                    <View
                        style={[
                            theme.styles.progressFill,
                            { width: `${Math.round(summary.percentComplete * 100)}%` },
                        ]}
                    />
                </View>
            </View>
            <FontAwesomeIcon
                name="chevron-right"
                size={16}
                style={theme.styles.chevron}
            />
        </Pressable>
    );
};

export default ProfileCompletionLink;
