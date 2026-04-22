import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import { View, Text, ImageProps, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/BaseButton';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import 'react-native-gesture-handler';
import { IUserState } from 'therr-react/types';
import { bindActionCreators } from 'redux';
import { buildStyles } from '../styles';
import { buildStyles as buildFTUIStyles } from '../styles/first-time-ui';
import { buildStyles as buildAuthFormStyles } from '../styles/forms/authenticationForms';
import { buildStyles as buildFormStyles } from '../styles/forms';
import spacingStyles from '../styles/layouts/spacing';
import UsersActions from '../redux/actions/UsersActions';
import translator from '../utilities/translator';
import BaseStatusBar from '../components/BaseStatusBar';
import ftuiClaim from '../assets/ftui-claim.json';
import ftuiDiscover from '../assets/ftui-discover.json';
import ftuiMoment from '../assets/ftui-moment.json';
import ftuiClaimLight from '../assets/ftui-claim-light.json';
import ftuiDiscoverLight from '../assets/ftui-discover-light.json';
import ftuiMomentLight from '../assets/ftui-moment-light.json';
import background1 from '../assets/dinner-burgers.webp';
import background2 from '../assets/dinner-overhead.webp';
import background3 from '../assets/dinner-overhead-2.webp';
import { useSwipe } from '../hooks/useSwipe';

// const { width: viewportWidth } = Dimensions.get('window');

interface FadeInBackgroundImageProps extends ImageProps {
    opacity: number;
}

const FadeInBackgroundImage: React.FC<FadeInBackgroundImageProps> = ({ opacity, style, ...rest }) => {
    const opacityValue = useSharedValue(opacity);

    useEffect(() => {
        opacityValue.value = withTiming(opacity, { duration: 400 });
    }, [opacity, opacityValue]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacityValue.value,
    }));

    return (
        <Animated.Image
            {...rest}
            resizeMode="cover"
            style={[
                style,
                {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    flex: 1,
                    width: '100%',
                    height: 'auto',
                    justifyContent: 'center',
                },
                animatedStyle,
            ]}
            progressiveRenderingEnabled={true}
        />
    );
};

const BackgroundOverlay = ({
    themeFTUI,
}) => (
    <View
        style={themeFTUI.styles.landingBackgroundOverlay}
    />
);

const ContentOverlay = ({
    backgroundIndex,
    backgroundText,
    backgroundButtonText,
    onButtonPress,
    onButtonBackPress,
    themeAuthForm,
    themeForms,
    themeFTUI,
}) => {
    const insets = useSafeAreaInsets();
    const onSwipeLeft = () => {
        onButtonPress();
    };

    const onSwipeRight = () => {
        onButtonBackPress();
    };

    const { onTouchStart, onTouchEnd } = useSwipe(onSwipeLeft, onSwipeRight, 6);

    return (
        <Pressable
            style={themeFTUI.styles.landingContentOverlay}
            onStartShouldSetResponder={() => true}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            <Text
                style={[
                    backgroundIndex === 2 ? themeFTUI.styles.landingContentTitleSmall : themeFTUI.styles.landingContentTitle,
                    spacingStyles.padHorizLg,
                    {
                        position: 'absolute',
                        top: insets.top + 80,
                    },
                ]}>
                {backgroundText}
            </Text>
            <View style={[
                themeAuthForm.styles.submitButtonContainer,
                {
                    position: 'absolute',
                    bottom: insets.bottom + 32,
                },
            ]}>
                <Button
                    type="clear"
                    buttonStyle={[
                        themeForms.styles.buttonRoundAlt,
                        spacingStyles.padHorizLg,
                    ]}
                    titleStyle={themeForms.styles.buttonTitleAlt}
                    title={backgroundButtonText}
                    onPress={onButtonPress}
                />
            </View>
        </Pressable>
    );
};


// const graphicStyles: any = {
//     width: '100%',
//     maxHeight: 200,
//     minHeight: 200,
//     flex: 1,
//     padding: 0,
// };

interface ILandingDispatchProps {
    login: Function;
}

interface IStoreProps extends ILandingDispatchProps {
    user: IUserState;
}

// Regular component props
export interface ILandingProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface ILandingState {
    activeSlide: number;
    backgroundIndex: number;
    backgroundText: string;
    backgroundButtonText: string;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            login: UsersActions.login,
        },
        dispatch
    );

class LandingComponent extends React.Component<ILandingProps, ILandingState> {
    private translate;
    private cachedUserDetails;
    private ftuiData;
    private theme = buildStyles();
    private themeAuthForm = buildAuthFormStyles();
    private themeFTUI = buildFTUIStyles();
    private themeForms = buildFormStyles();

    constructor(props) {
        super(props);

        this.translate = (key: string, params: any): string =>
            translator(props.user.settings?.locale || 'en-us', key, params);

        this.state = {
            activeSlide: 0,
            backgroundIndex: 0,
            backgroundText: this.translate(
                'pages.landing.background.shareYourInterests'
            ),
            backgroundButtonText: this.translate(
                'pages.landing.buttons.continue'
            ),
        };

        this.theme = buildStyles(props.user?.settings?.mobileThemeName);
        this.themeAuthForm = buildAuthFormStyles(props.user.settings?.mobileThemeName);
        this.themeFTUI = buildFTUIStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.cachedUserDetails = props.user?.details;
        this.ftuiData = [
            {
                title: this.translate('pages.landing.carousel.claimTitle'),
                subtitle: this.translate('pages.landing.carousel.claimDescription'),
                source: props.user?.settings?.mobileThemeName === 'light' ? ftuiClaimLight : ftuiClaim,
            },
            {
                title: this.translate('pages.landing.carousel.discoverTitle'),
                subtitle: this.translate('pages.landing.carousel.discoverDescription'),
                source: props.user?.settings?.mobileThemeName === 'light' ? ftuiDiscoverLight : ftuiDiscover,
            },
            {
                title: this.translate('pages.landing.carousel.momentTitle'),
                subtitle: this.translate('pages.landing.carousel.momentDescription'),
                source: props.user?.settings?.mobileThemeName === 'light' ? ftuiMomentLight : ftuiMoment,
            },
        ];
    }

    // TODO: On logout, ignore any deep link logic
    componentDidMount() {
        const { navigation, route } = this.props;
        const isVerifySuccess = route.params?.isVerifySuccess;

        if (!isVerifySuccess) {
            navigation.setOptions({
                title: this.translate('pages.landing.headerTitle'),
            });
        }
    }

    navTo = (routeName) => {
        const { navigation } = this.props;

        navigation.navigate(routeName);
    };

    prevBackground = () => {
        const { backgroundIndex } = this.state;
        if (backgroundIndex === 1) {
            logEvent(getAnalytics(),'landing_progress_started').catch((err) => console.log(err));
            this.setState({
                backgroundIndex: 0,
                backgroundText: this.translate(
                    'pages.landing.background.shareYourInterests'
                ),
                backgroundButtonText: this.translate(
                    'pages.landing.buttons.continue'
                ),
            });
        }

        if (backgroundIndex === 2) {
            this.setState({
                backgroundIndex: 1,
                backgroundText: this.translate('pages.landing.background.inviteFriends'),
                backgroundButtonText: this.translate(
                    'pages.landing.buttons.next'
                ),
            });
        }
    };

    nextBackground = () => {
        const { backgroundIndex } = this.state;
        if (backgroundIndex === 0) {
            logEvent(getAnalytics(),'landing_progress_started').catch((err) => console.log(err));
            this.setState({
                backgroundIndex: 1,
                backgroundText: this.translate('pages.landing.background.inviteFriends'),
                backgroundButtonText: this.translate(
                    'pages.landing.buttons.next'
                ),
            });
        }

        if (backgroundIndex === 1) {
            this.setState({
                backgroundIndex: 2,
                backgroundText: this.translate('pages.landing.background.getMatched'),
                backgroundButtonText: this.translate(
                    'pages.landing.buttons.getStarted'
                ),
            });
        }
    };

    render() {
        const { backgroundIndex, backgroundText, backgroundButtonText } = this.state;
        let onButtonPress = (e) => {
            e?.preventDefault();
            this.navTo('Register');
        };
        let onButtonBackPress = (e) => {
            e?.preventDefault();
        };
        if (backgroundIndex < 2) {
            onButtonPress = (e) => {
                e?.preventDefault();
                this.nextBackground();
            };
        }
        if (backgroundIndex > 0) {
            onButtonBackPress = (e) => {
                e?.preventDefault();
                this.prevBackground();
            };
        }

        return (
            <>
                <BaseStatusBar therrThemeName={'dark'}/>
                <View style={{
                    flex: 1,
                    position: 'relative',
                    width: '100%',
                }}>
                    <FadeInBackgroundImage
                        source={background1}
                        opacity={backgroundIndex === 0 ? 1 : 0}
                    />
                    <FadeInBackgroundImage
                        source={background2}
                        opacity={backgroundIndex === 1 ? 1 : 0}
                    />
                    <FadeInBackgroundImage
                        source={background3}
                        opacity={backgroundIndex === 2 ? 1 : 0}
                    />
                    <BackgroundOverlay
                        themeFTUI={this.themeFTUI}
                    />
                    <ContentOverlay
                        backgroundIndex={backgroundIndex}
                        backgroundText={backgroundText}
                        backgroundButtonText={backgroundButtonText}
                        onButtonPress={onButtonPress}
                        onButtonBackPress={onButtonBackPress}
                        themeAuthForm={this.themeAuthForm}
                        themeForms={this.themeForms}
                        themeFTUI={this.themeFTUI}
                    />
                </View>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(LandingComponent);
