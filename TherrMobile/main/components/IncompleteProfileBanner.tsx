import React from 'react';
import { Pressable, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { IUserState } from 'therr-react/types';
import { buildStyles } from '../styles/incompleteProfileBanner';

const DISMISSED_AT_KEY = 'incompleteProfileBannerDismissedAt';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface IIncompleteProfileBannerProps {
    navigation: any;
    translate: (key: string, params?: any) => string;
    user: IUserState;
    themeName?: string;
}

interface IIncompleteProfileBannerState {
    isDismissed: boolean;
    isReady: boolean;
}

/**
 * Dismissible banner that nudges users who have not provided a first name
 * (now optional during onboarding) to add it later so friends can recognize
 * them. Dismissal is persisted to AsyncStorage with a timestamp and the banner
 * re-appears after 7 days.
 */
class IncompleteProfileBanner extends React.Component<IIncompleteProfileBannerProps, IIncompleteProfileBannerState> {
    private theme = buildStyles();

    constructor(props: IIncompleteProfileBannerProps) {
        super(props);

        this.state = {
            isDismissed: false,
            isReady: false,
        };

        this.theme = buildStyles(props.themeName as any);
    }

    componentDidMount() {
        AsyncStorage.getItem(DISMISSED_AT_KEY)
            .then((value) => {
                const dismissedAt = value ? parseInt(value, 10) : 0;
                const isStillDismissed = !!dismissedAt && (Date.now() - dismissedAt) < SEVEN_DAYS_MS;
                this.setState({
                    isDismissed: isStillDismissed,
                    isReady: true,
                });
            })
            .catch(() => {
                this.setState({ isReady: true });
            });
    }

    handlePress = () => {
        const { navigation } = this.props;
        navigation.navigate('ManageAccount');
    };

    handleDismiss = () => {
        this.setState({ isDismissed: true });
        AsyncStorage.setItem(DISMISSED_AT_KEY, `${Date.now()}`).catch(() => {
            // Non-critical: if persistence fails the banner simply re-shows next launch
        });
    };

    render() {
        const { translate, user } = this.props;
        const { isDismissed, isReady } = this.state;

        // Only render once we've read the dismissal timestamp, when the user has
        // no first name, and when not currently dismissed.
        if (!isReady || isDismissed || user?.details?.firstName) {
            return null;
        }

        return (
            <Pressable
                style={this.theme.styles.container}
                onPress={this.handlePress}
                accessibilityRole="button"
                accessibilityLabel={translate('components.incompleteProfileBanner.message')}
            >
                <FontAwesomeIcon
                    name="user-edit"
                    size={20}
                    style={this.theme.styles.leadingIcon}
                />
                <Text style={this.theme.styles.message}>
                    {translate('components.incompleteProfileBanner.message')}
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
