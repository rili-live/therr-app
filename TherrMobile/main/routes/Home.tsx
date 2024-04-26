import React from 'react';
import { SafeAreaView, View, Text } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { IUserState } from 'therr-react/types';
import { UsersService } from 'therr-react/services';
import Alert from '../components/Alert';
import RoundTextInput from '../components/Input/TextInput/Round';
import MainButtonMenu from '../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../redux/actions/UsersActions';
import translator from '../services/translator';
import BaseStatusBar from '../components/BaseStatusBar';
import { buildStyles, addMargins } from '../styles';
import { buildStyles as buildMenuStyles } from '../styles/navigation/buttonMenu';
import { buildStyles as buildAlertStyles } from '../styles/alerts';
import { buildStyles as buildFormStyles } from '../styles/forms';

interface IHomeDispatchProps {
    logout: Function;
}

interface IStoreProps extends IHomeDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IHomeProps extends IStoreProps {
    navigation: any;
}

interface IHomeState {
    inputs: any;
    prevReqSuccess: string;
    prevReqError: string;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            logout: UsersActions.logout,
        },
        dispatch
    );

class Home extends React.Component<IHomeProps, IHomeState> {
    private translate: Function;
    private quote: string;
    private quoteAuthor: string;
    private theme = buildStyles();
    private themeAlerts = buildAlertStyles();
    private themeMenu = buildMenuStyles();
    private themeForms = buildFormStyles();

    constructor(props) {
        super(props);

        this.state = {
            inputs: {},
            prevReqError: '',
            prevReqSuccess: '',
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeAlerts = buildAlertStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);

        const quote = this.translate('quoteOfTheDay');
        const quoteSplit = quote.split(' - ');
        this.quote = quoteSplit[0];
        this.quoteAuthor = quoteSplit[1];
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: 'Therr',
        });
    }

    isFormDisabled = () => !this.state?.inputs?.feedbackMessage;

    onInputChange = (name: string, value: string) => {
        const newInputChanges = {
            [name]: value,
        };

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            prevReqError: '',
            prevReqSuccess: '',
        });
    };

    onSubmit = () => {
        const { inputs } = this.state;

        UsersService.sendFeedback(inputs.feedbackMessage)
            .then(() => {
                this.setState({
                    inputs: {
                        feedbackMessage: '',
                    },
                    prevReqSuccess: this.translate('pages.userProfile.messages.success'),
                });
            })
            .catch((error) => {
                console.log(error);
                this.setState({
                    prevReqError: this.translate('pages.userProfile.messages.error'),
                });
            });
    };

    handleRefresh = () => {
        console.log('refresh');
    };

    render() {
        const { navigation, user } = this.props;
        const { inputs, prevReqSuccess, prevReqError } = this.state;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        style={this.theme.styles.scrollViewFull}
                    >
                        <View style={this.theme.styles.body}>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitleCenter}>
                                    {this.translate('pages.userProfile.h2.quoteOfTheDay')}
                                </Text>
                                <Text style={this.theme.styles.sectionQuote}>
                                    {`"${this.quote}" - ${this.quoteAuthor}`}
                                </Text>
                            </View>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitleCenter}>
                                    {this.translate('pages.userProfile.h2.shareFeedback')}
                                </Text>
                                <RoundTextInput
                                    placeholder={this.translate(
                                        'pages.userProfile.labels.feedbackPlaceholder'
                                    )}
                                    value={inputs.feedbackMessage}
                                    onChangeText={(text) =>
                                        this.onInputChange('feedbackMessage', text)
                                    }
                                    numberOfLines={5}
                                    themeForms={this.themeForms}
                                    minHeight={100}
                                />
                                <Alert
                                    containerStyles={addMargins({
                                        marginBottom: 24,
                                    })}
                                    isVisible={!!prevReqSuccess || !!prevReqError}
                                    message={prevReqSuccess ? prevReqSuccess : prevReqError}
                                    type={prevReqSuccess ? 'success' : 'error'}
                                    themeAlerts={this.themeAlerts}
                                />
                                <View style={this.theme.styles.sectionContainer}>
                                    <Button
                                        buttonStyle={this.themeForms.styles.button}
                                        disabledStyle={this.themeForms.styles.buttonDisabled}
                                        title={this.translate(
                                            'pages.userProfile.buttons.send'
                                        )}
                                        onPress={this.onSubmit}
                                        disabled={this.isFormDisabled()}
                                        raised={false}
                                    />
                                </View>
                            </View>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitleCenter}>
                                    {this.translate('pages.userProfile.h2.howItWorks')}
                                </Text>
                                <Text style={this.theme.styles.sectionDescription}>
                                    {this.translate('pages.userProfile.siteDescription1')}
                                </Text>
                                <Text style={this.theme.styles.sectionDescription}>
                                    {this.translate('pages.userProfile.siteDescription2')}
                                </Text>
                                <Text style={this.theme.styles.sectionDescription}>
                                    {this.translate('pages.userProfile.siteDescription3')}
                                </Text>
                                <Text style={this.theme.styles.sectionDescription}>
                                    {this.translate('pages.userProfile.siteDescription4')}
                                </Text>
                            </View>
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
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

export default connect(mapStateToProps, mapDispatchToProps)(Home);
