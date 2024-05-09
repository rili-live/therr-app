import React, { useRef } from 'react';
import { connect } from 'react-redux';
import { Animated, SafeAreaView, View, Text, ImageProps } from 'react-native';
import { Button } from 'react-native-elements';
import analytics from '@react-native-firebase/analytics';
import 'react-native-gesture-handler';
import { IUserState } from 'therr-react/types';
import { bindActionCreators } from 'redux';
import { buildStyles } from '../styles';
import { buildStyles as buildFTUIStyles } from '../styles/first-time-ui';
import { buildStyles as buildAuthFormStyles } from '../styles/forms/authenticationForms';
import { buildStyles as buildFormStyles } from '../styles/forms';
import spacingStyles from '../styles/layouts/spacing';
import UsersActions from '../redux/actions/UsersActions';
import translator from '../services/translator';
import BaseStatusBar from '../components/BaseStatusBar';
// import ftuiClaim from '../assets/discover.json';
import ftuiClaim from '../assets/ftui-claim.json';
import ftuiDiscover from '../assets/ftui-discover.json';
import ftuiMoment from '../assets/ftui-moment.json';
import ftuiClaimLight from '../assets/ftui-claim-light.json';
import ftuiDiscoverLight from '../assets/ftui-discover-light.json';
import ftuiMomentLight from '../assets/ftui-moment-light.json';
import background1 from '../assets/dinner-burgers.webp';
import background2 from '../assets/dinner-overhead.webp';
import background3 from '../assets/dinner-overhead-2.webp';

// const { width: viewportWidth } = Dimensions.get('window');

interface FadeInBackgroundImageProps extends ImageProps {
    opacity: number;
}

const FadeInBackgroundImage: React.FC<FadeInBackgroundImageProps> = props => {
    const fadeAnim = useRef(new Animated.Value(props.opacity)).current; // Initial value for opacity: 0

    return (
        <Animated.Image
            resizeMode="cover"
            style={[
                props.style,
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
                {
                    opacity: fadeAnim, // Bind opacity to animated value
                },
            ]}
            progressiveRenderingEnabled={true}
            { ...props }
        />
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
            translator('en-us', key, params);

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

    nextBackground = () => {
        const { backgroundIndex } = this.state;
        if (backgroundIndex === 0) {
            analytics().logEvent('landing_progress_started').catch((err) => console.log(err));
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

    // renderFTUISlide = ({
    //     title,
    //     subtitle,
    //     source,
    // }) => {
    //     return (
    //         <View style={this.themeFTUI.styles.slideContainer}>
    //             <View style={this.themeFTUI.styles.graphicImgContainer}>
    //                 <AnimatedLottieView
    //                     source={source}
    //                     resizeMode="contain"
    //                     speed={1}
    //                     autoPlay={false}
    //                     loop
    //                     style={graphicStyles}
    //                 />
    //             </View>
    //             <View style={[this.theme.styles.sectionContainerWide, spacingStyles.marginBotNone]}>
    //                 <Text style={[this.themeFTUI.styles.titleWithNoSpacing, this.theme.styles.textCenter]}>
    //                     {title}
    //                 </Text>
    //                 <Text style={[this.themeFTUI.styles.subtitle, this.theme.styles.textCenter, spacingStyles.marginBotNone]}>
    //                     {subtitle}
    //                 </Text>
    //             </View>
    //         </View>
    //     );
    // };

    // renderLandingSlider = () => {
    //     const { activeSlide } = this.state;
    //     const sliderWidth = viewportWidth - (2 * this.theme.styles.bodyFlex.padding);
    //     const iPadDynamicStyles: any = (Platform.OS === 'ios' && Platform.isPad)
    //         ? { paddingHorizontal: '10%' }
    //         : {};

    //     return (
    //         <KeyboardAwareScrollView
    //             contentInsetAdjustmentBehavior="automatic"
    //             style={this.theme.styles.bodyFlex}
    //             contentContainerStyle={this.theme.styles.bodyScroll}
    //         >
    //             <Carousel
    //                 contentInsetAdjustmentBehavior="automatic"
    //                 containerCustomStyle={{ marginTop: 40 }}
    //                 vertical={false}
    //                 data={this.ftuiData}
    //                 renderItem={({ item }) => this.renderFTUISlide(item)}
    //                 sliderWidth={sliderWidth}
    //                 sliderHeight={sliderWidth}
    //                 itemWidth={sliderWidth}
    //                 itemHeight={sliderWidth}
    //                 onSnapToItem={(index) => this.setState({ activeSlide: index }) }
    //                 slideStyle={{ width: sliderWidth }}
    //                 inactiveSlideOpacity={1}
    //                 inactiveSlideScale={1}
    //                 windowSize={21}
    //             />
    //             <Pagination
    //                 dotsLength={this.ftuiData.length}
    //                 activeDotIndex={activeSlide}
    //                 containerStyle={{ marginBottom: 25 }}
    //                 dotStyle={this.themeFTUI.styles.sliderDot}
    //                 inactiveDotStyle={{
    //                     // Define styles for inactive dots here
    //                 }}
    //                 inactiveDotOpacity={0.4}
    //                 inactiveDotScale={0.8}
    //             />
    //             <View style={iPadDynamicStyles}>
    //                 <View style={this.themeAuthForm.styles.submitButtonContainer}>
    //                     <Button
    //                         buttonStyle={this.themeForms.styles.buttonPrimary}
    //                         titleStyle={this.themeForms.styles.buttonTitle}
    //                         disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
    //                         disabledStyle={this.themeForms.styles.buttonDisabled}
    //                         title={this.translate(
    //                             'pages.landing.buttons.getStarted'
    //                         )}
    //                         onPress={() => this.navTo('Register')}
    //                     />
    //                 </View>
    //                 <OrDivider
    //                     translate={this.translate}
    //                     themeForms={this.themeForms}
    //                     containerStyle={{
    //                         marginBottom: 20,
    //                     }}
    //                 />
    //                 <View style={[this.themeAuthForm.styles.submitButtonContainer, { paddingBottom: '15%' }]}>
    //                     <Button
    //                         type="clear"
    //                         buttonStyle={this.themeForms.styles.buttonRoundAlt}
    //                         titleStyle={this.themeForms.styles.buttonTitleAlt}
    //                         title={this.translate(
    //                             'pages.landing.buttons.signIn'
    //                         )}
    //                         onPress={() => this.navTo('Login')}
    //                     />
    //                 </View>
    //             </View>
    //         </KeyboardAwareScrollView>
    //     );
    // };

    render() {
        const { backgroundIndex, backgroundText, backgroundButtonText } = this.state;
        let onButtonPress = () => this.navTo('Register');
        if (backgroundIndex < 2) {
            onButtonPress = () => this.nextBackground();
        }

        return (
            <>
                <BaseStatusBar therrThemeName={'dark'}/>
                <SafeAreaView style={[
                    this.theme.styles.safeAreaView,
                    {
                        flex: 1,
                        position: 'relative',
                    },
                ]}>
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
                    <View
                        style={this.themeFTUI.styles.landingBackgroundOverlay}
                    >
                    </View>
                    <View
                        style={this.themeFTUI.styles.landingContentOverlay}
                    >
                        <Text
                            style={[
                                this.themeFTUI.styles.landingContentTitle,
                                spacingStyles.padHorizLg,
                                {
                                    position: 'absolute',
                                    top: 150,
                                },
                            ]}>
                            {backgroundText}
                        </Text>
                        <View style={[
                            this.themeAuthForm.styles.submitButtonContainer,
                            {
                                position: 'absolute',
                                bottom: 50,
                            },
                        ]}>
                            <Button
                                type="clear"
                                buttonStyle={[
                                    this.themeForms.styles.buttonRoundAlt,
                                    spacingStyles.padHorizLg,
                                ]}
                                titleStyle={this.themeForms.styles.buttonTitleAlt}
                                title={backgroundButtonText}
                                onPress={onButtonPress}
                            />
                        </View>
                    </View>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(LandingComponent);
