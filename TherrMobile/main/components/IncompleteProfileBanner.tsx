import React from 'react';
import { Pressable, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { IUserState } from 'therr-react/types';
import { buildStyles } from '../styles/incompleteProfileBanner';
import {
    DEFAULT_PROFILE_COMPLETION_FLAGS,
    IProfileCompletionFlags,
    getProfileCompletionSummary,
    syncInterestsFlag,
} from '../utilities/profileCompletion';

const DISMISSED_AT_KEY = 'incompleteProfileBannerDismissedAt';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface IIncompleteProfileBannerProps {
    navigation: any;
    translate: (key: string, params?: any) => string;
    user: IUserState;
    themeName?: string;
}

interface IIncompleteProfileBannerState {
    flags: IProfileCompletionFlags | null;
    isDismissed: boolean;
    isReady: boolean;
}

/**
 * Dismissible banner that nudges users with an unfinished profile toward the
 * guided completion flow. It reads the same step model as the "Finish your
 * profile" card so the two can never disagree about what is left. Dismissal is
 * persisted to AsyncStorage with a timestamp and the banner re-appears after
 * 7 days.
 */
class IncompleteProfileBanner extends React.Component<IIncompleteProfileBannerProps, IIncompleteProfileBannerState> {
    private theme = buildStyles();

    private isUnmounted = false;

    constructor(props: IIncompleteProfileBannerProps) {
        super(props);

        this.state = {
            flags: null,
            isDismissed: false,
            isReady: false,
        };

        this.theme = buildStyles(props.themeName as any);
    }

    componentDidMount() {
        const { user } = this.props;

        // Both reads must land before `isReady` flips. Flipping it on the flags read
        // alone lets the banner render while `isDismissed` is still its initial
        // `false`, so a user who dismissed it sees it flash back in.
        const dismissedAtPromise = AsyncStorage.getItem(DISMISSED_AT_KEY)
            .then((value) => {
                const dismissedAt = value ? parseInt(value, 10) : 0;

                return !!dismissedAt && (Date.now() - dismissedAt) < SEVEN_DAYS_MS;
            })
            .catch(() => false);

        Promise.all([
            dismissedAtPromise,
            syncInterestsFlag(user?.details?.id).catch(() => DEFAULT_PROFILE_COMPLETION_FLAGS),
        ]).then(([isDismissed, flags]) => this.safeSetState({
            flags,
            isDismissed,
            isReady: true,
        }));
    }

    componentWillUnmount() {
        this.isUnmounted = true;
    }

    safeSetState = (state: Partial<IIncompleteProfileBannerState>) => {
        if (!this.isUnmounted) {
            this.setState(state as IIncompleteProfileBannerState);
        }
    };

    handlePress = () => {
        const { navigation, user } = this.props;
        const { flags } = this.state;
        const summary = getProfileCompletionSummary(user, flags || DEFAULT_PROFILE_COMPLETION_FLAGS);

        navigation.navigate('CreateProfile', {
            stage: summary.nextStep?.stage || 'details',
            isGuidedStep: true,
        });
    };

    handleDismiss = () => {
        this.setState({ isDismissed: true });
        AsyncStorage.setItem(DISMISSED_AT_KEY, `${Date.now()}`).catch(() => {
            // Non-critical: if persistence fails the banner simply re-shows next launch
        });
    };

    render() {
        const { translate, user } = this.props;
        const { flags, isDismissed, isReady } = this.state;

        const summary = getProfileCompletionSummary(user, flags || DEFAULT_PROFILE_COMPLETION_FLAGS);

        // Only render once the persisted state has been read, when steps remain,
        // and when not currently dismissed.
        if (!isReady || isDismissed || summary.isComplete) {
            return null;
        }

        const message = translate(
            summary.remainingCount === 1
                ? 'components.incompleteProfileBanner.messageSingular'
                : 'components.incompleteProfileBanner.message',
            { count: summary.remainingCount },
        );

        return (
            <Pressable
                style={this.theme.styles.container}
                onPress={this.handlePress}
                accessibilityRole="button"
                accessibilityLabel={message}
            >
                <FontAwesomeIcon
                    name="user-edit"
                    size={20}
                    style={this.theme.styles.leadingIcon}
                />
                <Text style={this.theme.styles.message}>
                    {message}
                </Text>
                <Pressable
                    onPress={this.handleDismiss}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={translate('components.incompleteProfileBanner.dismiss')}
                    style={this.theme.styles.dismissButton}
                >
                    <FontAwesomeIcon
                        name="times"
                        size={18}
                        style={this.theme.styles.dismissIcon}
                    />
                </Pressable>
            </Pressable>
        );
    }
}

export default IncompleteProfileBanner;
