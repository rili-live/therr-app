import React from 'react';
import { SafeAreaView, View, Text } from 'react-native';
import { Button } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { UsersService } from 'therr-react/services';
import { IUserState } from 'therr-react/types';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import BaseStatusBar from '../../components/BaseStatusBar';


interface IExchangePointsDisclaimerDispatchProps {
    updateUser: Function;
}

interface IStoreProps extends IExchangePointsDisclaimerDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IExchangePointsDisclaimerProps extends IStoreProps {
    navigation: any;
}

interface IExchangePointsDisclaimerState {}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
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

        this.state = {};

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount = () => {
        this.props.navigation.setOptions({
            title: this.translate('pages.exchangePointsDisclaimer.headerTitle'),
        });
    }

    handleRefresh = () => {
        console.log('refresh');
    }

    isFormDisabled = () => {
        const { user } = this.props;

        return (user.settings?.settingsTherrCoinTotal || 0) < 5;
    }

    onSubmit = () => {
        const { user } = this.props;

        // TODO: Allow user to specify an amount
        UsersService.requestRewardsExchange(user.settings?.settingsTherrCoinTotal).catch((err) => {
            console.log(err);
        });
    }

    render() {
        const { navigation, user } = this.props;
        const pageHeader = this.translate('pages.exchangePointsDisclaimer.pageHeader');
        const pageHeaderYourCoins = this.translate('pages.exchangePointsDisclaimer.pageHeaderYourCoins');
        const pageHeaderHow = this.translate('pages.exchangePointsDisclaimer.pageHeaderHow');

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
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitleCenter}>
                                    {pageHeaderYourCoins}
                                </Text>
                                <Text style={[this.theme.styles.sectionTitleCenter, { color: this.theme.colors.primary3 }]}>
                                    {user.settings?.settingsTherrCoinTotal || 0}
                                </Text>
                            </View>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitleCenter}>
                                    {pageHeaderHow}
                                </Text>
                                <View style={{ display: 'flex', flexDirection: 'row' }}>
                                    <View style={{ width: 50, alignItems: 'center' }}>
                                        <MaterialIcon
                                            name="looks-one"
                                            size={23}
                                            style={{ color: this.theme.colors.primary4 }}
                                        />
                                    </View>
                                    <Text style={[this.theme.styles.sectionDescription16, { flex: 1 }]}>
                                        {this.translate('pages.exchangePointsDisclaimer.info.stepOne')}
                                    </Text>
                                </View>
                                <View style={{ display: 'flex', flexDirection: 'row' }}>
                                    <View style={{ width: 50, alignItems: 'center' }}>
                                        <MaterialIcon
                                            name="looks-two"
                                            size={23}
                                            style={{ color: this.theme.colors.primary4 }}
                                        />
                                    </View>
                                    <Text style={[this.theme.styles.sectionDescription16, { flex: 1 }]}>
                                        {this.translate('pages.exchangePointsDisclaimer.info.stepTwo')}
                                    </Text>
                                </View>
                                <View style={{ display: 'flex', flexDirection: 'row' }}>
                                    <View style={{ width: 50, alignItems: 'center' }}>
                                        <MaterialIcon
                                            name="looks-3"
                                            size={23}
                                            style={{ color: this.theme.colors.primary4 }}
                                        />
                                    </View>
                                    <Text style={[this.theme.styles.sectionDescription16, { flex: 1 }]}>
                                        {this.translate('pages.exchangePointsDisclaimer.info.stepThree')}
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
