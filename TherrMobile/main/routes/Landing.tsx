import React from 'react';
import { connect } from 'react-redux';
import { Dimensions, SafeAreaView, View, Text } from 'react-native';
import { Button } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import 'react-native-gesture-handler';
import { IUserState } from 'therr-react/types';
import Carousel, { Pagination } from 'react-native-snap-carousel';
import { bindActionCreators } from 'redux';
import AnimatedLottieView from 'lottie-react-native';
import { buildStyles } from '../styles';
import { buildStyles as buildFTUIStyles } from '../styles/first-time-ui';
import { buildStyles as buildAuthFormStyles } from '../styles/forms/authenticationForms';
import { buildStyles as buildFormStyles } from '../styles/forms';
import spacingStyles from '../styles/layouts/spacing';
import UsersActions from '../redux/actions/UsersActions';
import translator from '../services/translator';
import BaseStatusBar from '../components/BaseStatusBar';
import OrDivider from '../components/Input/OrDivider';
// import ftuiClaim from '../assets/discover.json';
import ftuiClaim from '../assets/ftui-claim.json';
import ftuiDiscover from '../assets/ftui-discover.json';
import ftuiMoment from '../assets/ftui-moment.json';
import ftuiClaimLight from '../assets/ftui-claim-light.json';
import ftuiDiscoverLight from '../assets/ftui-discover-light.json';
import ftuiMomentLight from '../assets/ftui-moment-light.json';

const { width: viewportWidth } = Dimensions.get('window');


const graphicStyles: any = {
    width: '100%',
    maxHeight: 200,
    minHeight: 200,
    flex: 1,
    padding: 0,
};

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

        this.state = {
            activeSlide: 0,
        };

        this.theme = buildStyles(props.user?.settings?.mobileThemeName);
        this.themeAuthForm = buildAuthFormStyles(props.user.settings?.mobileThemeName);
        this.themeFTUI = buildFTUIStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any): string =>
            translator('en-us', key, params);
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

    renderFTUISlide = ({
        title,
        subtitle,
        source,
    }) => {
        return (
            <View style={this.themeFTUI.styles.slideContainer}>
                <View style={this.themeFTUI.styles.graphicImgContainer}>
                    <AnimatedLottieView
                        source={source}
                        resizeMode="contain"
                        speed={1}
                        autoPlay={false}
                        loop
                        style={graphicStyles}
                    />
                </View>
                <View style={[this.theme.styles.sectionContainerWide, spacingStyles.marginBotNone]}>
                    <Text style={[this.themeFTUI.styles.titleWithNoSpacing, this.theme.styles.textCenter]}>
                        {title}
                    </Text>
                    <Text style={[this.themeFTUI.styles.subtitle, this.theme.styles.textCenter, spacingStyles.marginBotNone]}>
                        {subtitle}
                    </Text>
                </View>
            </View>
        );
    };

    render() {
        const { activeSlide } = this.state;
        const sliderWidth = viewportWidth - (2 * this.theme.styles.bodyFlex.padding);

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        style={this.theme.styles.bodyFlex}
                        contentContainerStyle={this.theme.styles.bodyScroll}
                    >
                        <Carousel
                            contentInsetAdjustmentBehavior="automatic"
                            containerCustomStyle={{ marginTop: 40 }}
                            vertical={false}
                            data={this.ftuiData}
                            renderItem={({ item }) => this.renderFTUISlide(item)}
                            sliderWidth={sliderWidth}
                            sliderHeight={sliderWidth}
                            itemWidth={sliderWidth}
                            itemHeight={sliderWidth}
                            onSnapToItem={(index) => this.setState({ activeSlide: index }) }
                            slideStyle={{ width: sliderWidth }}
                            inactiveSlideOpacity={1}
                            inactiveSlideScale={1}
                            windowSize={21}
                        />
                        <Pagination
                            dotsLength={this.ftuiData.length}
                            activeDotIndex={activeSlide}
                            containerStyle={{ marginBottom: 25 }}
                            dotStyle={this.themeFTUI.styles.sliderDot}
                            inactiveDotStyle={{
                                // Define styles for inactive dots here
                            }}
                            inactiveDotOpacity={0.4}
                            inactiveDotScale={0.8}
                        />
                        <View style={this.themeAuthForm.styles.submitButtonContainer}>
                            <Button
                                buttonStyle={this.themeForms.styles.buttonPrimary}
                                titleStyle={this.themeForms.styles.buttonTitle}
                                disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                                disabledStyle={this.themeForms.styles.buttonDisabled}
                                title={this.translate(
                                    'pages.landing.buttons.getStarted'
                                )}
                                onPress={() => this.navTo('Register')}
                            />
                        </View>
                        <OrDivider
                            translate={this.translate}
                            themeForms={this.themeForms}
                            containerStyle={{
                                marginBottom: 20,
                            }}
                        />
                        <View style={[this.themeAuthForm.styles.submitButtonContainer, { paddingBottom: '15%' }]}>
                            <Button
                                type="clear"
                                buttonStyle={this.themeForms.styles.buttonRoundAlt}
                                titleStyle={this.themeForms.styles.buttonTitleAlt}
                                title={this.translate(
                                    'pages.landing.buttons.signIn'
                                )}
                                onPress={() => this.navTo('Login')}
                            />
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(LandingComponent);
