import React from 'react';
import { SafeAreaView, View, Text } from 'react-native';
import { Button } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';
import { UsersService } from 'therr-react/services';
import { IUserState } from 'therr-react/types';
import Toast from 'react-native-toast-message';
import { Picker as ReactPicker } from '@react-native-picker/picker';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import spacingStyles from '../../styles/layouts/spacing';
import BaseStatusBar from '../../components/BaseStatusBar';

const DOLLAR_MINIMUM = 10;

interface IExchangePointsDisclaimerDispatchProps {
    getMe: Function;
    updateUser: Function;
}

interface IStoreProps extends IExchangePointsDisclaimerDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IExchangePointsDisclaimerProps extends IStoreProps {
    navigation: any;
}

interface IExchangePointsDisclaimerState {
    exchangeRate?: number;
    inputs: any;
    isSubmitting: boolean;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getMe: UsersActions.getMe,
    updateUser: UsersActions.update,
}, dispatch);

export class ExchangePointsDisclaimer extends React.Component<IExchangePointsDisclaimerProps, IExchangePointsDisclaimerState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();
    private themeForms = buildFormStyles();

    constructor(props) {
        super(props);

        this.state = {
            isSubmitting: false,
            inputs: {
                giftCardProvider: '',
            },
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount = () => {
        this.props.navigation.setOptions({
            title: this.translate('pages.exchangePointsDisclaimer.headerTitle'),
        });
        this.props.getMe().catch((err) => console.log(`Failed to fetch me: ${err.message}`));
        UsersService.getExchangeRate().then((response) => {
            this.setState({
                exchangeRate: response.data?.exchangeRate,
            });
        }).catch((err) => console.log(`Failed to get exchange rate: ${err.message}`));
    };

    handleRefresh = () => {
        console.log('refresh');
    };

    isFormDisabled = () => {
        const { isSubmitting } = this.state;

        const dollar = this.getDollarTotal();

        // Minimum of $10 exchange
        return isSubmitting || dollar < DOLLAR_MINIMUM;
    };

    onSubmit = () => {
        const { inputs } = this.state;
        this.setState({
            isSubmitting: true,
        });

        const coinTotal = this.sanitizeCoinTotal();

        // TODO: Allow user to specify an amount
        UsersService.requestRewardsExchange(coinTotal, inputs.giftCardProvider).then(() => {
            Toast.show({
                type: 'successBig',
                text1: this.translate('pages.exchangePointsDisclaimer.alertTitles.requestSent'),
                text2: this.translate('pages.exchangePointsDisclaimer.alertMessages.requestSent'),
                visibilityTime: 3000,
            });
        }).catch(() => {
            Toast.show({
                type: 'errorBig',
                text1: this.translate('pages.exchangePointsDisclaimer.alertTitles.requestFailed'),
                text2: this.translate('pages.exchangePointsDisclaimer.alertMessages.requestFailed'),
                visibilityTime: 3000,
            });
        }).finally(() => {
            this.setState({
                isSubmitting: false,
            });
        });
    };

    sanitizeCoinTotal = () => {
        const { user } = this.props;
        const unrounded = user.settings?.settingsTherrCoinTotal || 0;
        const rounded = Math.round((Number(unrounded) + Number.EPSILON) * 100) / 100;
        return rounded;
    };

    getDollarTotal = () => {
        const { exchangeRate } = this.state;
        const unrounded = this.sanitizeCoinTotal() * (exchangeRate || 0);
        const rounded = Math.round((Number(unrounded) + Number.EPSILON) * 100) / 100;
        return rounded;
    };

    onInputChange = (name: string, value: string) => {
        const { inputs } = this.state;
        const newInputChanges = {
            [name]: value,
        };

        this.setState({
            inputs: {
                ...inputs,
                ...newInputChanges,
            },
            isSubmitting: false,
        });
    };

    render() {
        const { exchangeRate, inputs } = this.state;
        const { navigation, user } = this.props;
        const pageHeader = this.translate('pages.exchangePointsDisclaimer.pageHeader');
        const pageHeaderYourWallet = this.translate('pages.exchangePointsDisclaimer.pageHeaderYourWallet');
        const pageHeaderExchangeRate = this.translate('pages.exchangePointsDisclaimer.pageHeaderExchangeRate');
        const pageHeaderHow = this.translate('pages.exchangePointsDisclaimer.pageHeaderHow');
        const stepContainerStyle = [{ width: 50 }, spacingStyles.alignCenter];

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={this.theme.styles.scrollView}
                    >
                        <View style={this.theme.styles.body}>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitleCenter}>
                                    {pageHeader}
                                </Text>
                                <Text style={this.theme.styles.sectionDescriptionCentered}>
                                    {this.translate('pages.exchangePointsDisclaimer.info.earlyAccess')}
                                </Text>
                            </View>
                            <ReactPicker
                                selectedValue={inputs.giftCardProvider}
                                style={this.themeForms.styles.picker}
                                itemStyle={this.themeForms.styles.pickerItem}
                                onValueChange={(itemValue) =>
                                    this.onInputChange('giftCardProvider', itemValue)
                                }>
                                <ReactPicker.Item label={this.translate(
                                    'forms.settings.giftCardProviders.unselected'
                                )} value={''} />
                                <ReactPicker.Item label={this.translate(
                                    'forms.settings.giftCardProviders.amazon'
                                )} value={'Amazon'} />
                                <ReactPicker.Item label={this.translate(
                                    'forms.settings.giftCardProviders.chewy'
                                )} value={'Chewy'} />
                                <ReactPicker.Item label={this.translate(
                                    'forms.settings.giftCardProviders.doorDash'
                                )} value={'Door Dash'} />
                                <ReactPicker.Item label={this.translate(
                                    'forms.settings.giftCardProviders.grubHub'
                                )} value={'Grub Hub'} />
                                <ReactPicker.Item label={this.translate(
                                    'forms.settings.giftCardProviders.starbucks'
                                )} value={'Starbucks'} />
                                <ReactPicker.Item label={this.translate(
                                    'forms.settings.giftCardProviders.uberEats'
                                )} value={'Uber Eats'} />
                            </ReactPicker>
                            {
                                exchangeRate &&
                                    <View style={this.theme.styles.sectionContainer}>
                                        <Text style={this.theme.styles.sectionTitleCenter}>
                                            {pageHeaderExchangeRate}
                                        </Text>
                                        <Text style={[this.theme.styles.sectionTitleSmallCenter, { color: this.theme.colors.primary3 }]}>
                                            {this.translate('pages.exchangePointsDisclaimer.labels.exchangeRatePrefix', { exchangeRate })}
                                        </Text>
                                    </View>
                            }
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitleCenter}>
                                    {pageHeaderYourWallet}
                                </Text>
                                <Text style={[this.theme.styles.sectionTitleSmallCenter, { color: this.theme.colors.primary3 }]}>
                                    {this.translate('pages.exchangePointsDisclaimer.labels.coinsSuffix', {
                                        total: this.sanitizeCoinTotal(),
                                    })}
                                </Text>
                                {
                                    exchangeRate &&
                                    <Text style={[this.theme.styles.sectionTitleSmallCenter, { color: this.theme.colors.primary3 }]}>
                                        {this.translate('pages.exchangePointsDisclaimer.labels.dollarsPrefix', {
                                            total: this.getDollarTotal(),
                                        })}
                                    </Text>
                                }
                            </View>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitleCenter}>
                                    {pageHeaderHow}
                                </Text>
                                <View style={spacingStyles.flexRow}>
                                    <View style={stepContainerStyle}>
                                        <MaterialIcon
                                            name="looks-one"
                                            size={23}
                                            style={{ color: this.theme.colors.primary4 }}
                                        />
                                    </View>
                                    <Text style={[this.theme.styles.sectionDescription16, spacingStyles.flexOne]}>
                                        {this.translate('pages.exchangePointsDisclaimer.info.stepOne')}
                                    </Text>
                                </View>
                                <View style={spacingStyles.flexRow}>
                                    <View style={stepContainerStyle}>
                                        <MaterialIcon
                                            name="looks-two"
                                            size={23}
                                            style={{ color: this.theme.colors.primary4 }}
                                        />
                                    </View>
                                    <Text style={[this.theme.styles.sectionDescription16, spacingStyles.flexOne]}>
                                        {this.translate('pages.exchangePointsDisclaimer.info.stepTwo', {
                                            minimum: DOLLAR_MINIMUM,
                                        })}
                                    </Text>
                                </View>
                                <View style={spacingStyles.flexRow}>
                                    <View style={stepContainerStyle}>
                                        <MaterialIcon
                                            name="looks-3"
                                            size={23}
                                            style={{ color: this.theme.colors.primary4 }}
                                        />
                                    </View>
                                    <Text style={[this.theme.styles.sectionDescription16, spacingStyles.flexOne]}>
                                        {this.translate('pages.exchangePointsDisclaimer.info.stepThree')}
                                    </Text>
                                </View>
                                <View style={spacingStyles.flexRow}>
                                    <View style={stepContainerStyle}>
                                        <MaterialIcon
                                            name="looks-4"
                                            size={23}
                                            style={{ color: this.theme.colors.primary4 }}
                                        />
                                    </View>
                                    <Text style={[this.theme.styles.sectionDescription16, spacingStyles.flexOne]}>
                                        {this.translate('pages.exchangePointsDisclaimer.info.stepFour')}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
                <View style={this.themeMenu.styles.submitButtonContainerFloat}>
                    <Button
                        buttonStyle={this.themeForms.styles.button}
                        title={this.translate(
                            'forms.rewards.buttons.submit'
                        )}
                        onPress={this.onSubmit}
                        disabled={this.isFormDisabled()}
                        raised={true}
                        icon={
                            <FontAwesomeIcon
                                name="exchange"
                                size={23}
                                style={this.themeForms.styles.buttonIcon}
                            />
                        }
                    />
                </View>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ExchangePointsDisclaimer);
