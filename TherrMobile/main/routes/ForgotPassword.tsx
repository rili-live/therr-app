import React from 'react';
import { SafeAreaView, ScrollView, View, Text } from 'react-native';
import { Button }  from 'react-native-elements';
import 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'therr-react/types';
import { buildStyles, addMargins } from '../styles';
import { buildStyles as buildAlertStyles } from '../styles/alerts';
import { buildStyles as buildAuthFormStyles } from '../styles/forms/authenticationForms';
import { buildStyles as buildFormStyles } from '../styles/forms';
import translator from '../services/translator';
import UsersActions from '../redux/actions/UsersActions';
import Alert from '../components/Alert';
import VerificationCodesService from '../services/VerificationCodesService';
import RoundInput from '../components/Input/Round';
import BaseStatusBar from '../components/BaseStatusBar';

interface IForgotPasswordDispatchProps {
    updateUser: Function;
}

interface IStoreProps extends IForgotPasswordDispatchProps {}

// Regular component props
export interface IForgotPasswordProps extends IStoreProps {
    navigation: any;
    user: IUserState;
}

interface IForgotPasswordState {
    errorMsg: string;
    successMsg: string;
    inputs: any;
    isSubmitting: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateUser: UsersActions.update,
}, dispatch);

class ForgotPassword extends React.Component<IForgotPasswordProps, IForgotPasswordState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeAlerts = buildAlertStyles();
    private themeAuthForm = buildAuthFormStyles();
    private themeForms = buildFormStyles();

    constructor(props) {
        super(props);

        this.state = {
            errorMsg: '',
            successMsg: '',
            inputs: {
                email: '',
            },
            isSubmitting: false,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeAlerts = buildAlertStyles(props.user.settings?.mobileThemeName);
        this.themeAuthForm = buildAuthFormStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.translate('pages.forgotPassword.headerTitle'),
        });
    }

    isFormDisabled() {
        const { inputs, isSubmitting } = this.state;

        return (
            !inputs.email ||
            isSubmitting
        );
    }

    onSubmit = () => {
        const {
            email,
        } = this.state.inputs;

        if (!this.isFormDisabled()) {
            this.setState({
                isSubmitting: true,
            });
            VerificationCodesService.requestOneTimePassword(email?.toLowerCase())
                .then(() => {
                    this.setState({
                        inputs: {
                            email: '',
                        },
                        successMsg: this.translate('forms.forgotPassword.backendSuccessMessage'),
                    });
                })
                .catch((error: any) => {
                    if (
                        error.statusCode === 400 ||
                        error.statusCode === 401 ||
                        error.statusCode === 404
                    ) {
                        this.setState({
                            errorMsg: `${error.message}${
                                error.parameters
                                    ? '(' + error.parameters.toString() + ')'
                                    : ''
                            }`,
                        });
                    } else if (error.statusCode >= 500) {
                        this.setState({
                            errorMsg: this.translate('forms.forgotPassword.backendErrorMessage'),
                        });
                    }
                });
        }
    };

    onInputChange = (name: string, value: string) => {
        const newInputChanges = {
            [name]: value,
        };

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            errorMsg: '',
            successMsg: '',
            isSubmitting: false,
        });
    };

    render() {
        const { errorMsg, successMsg, inputs } = this.state;
        const pageHeader = this.translate('pages.forgotPassword.pageHeader');

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    <ScrollView style={this.theme.styles.bodyFlex} contentContainerStyle={this.theme.styles.bodyScrollSmall}>
                        <View style={this.theme.styles.sectionContainerAlt}>
                            <Text style={this.theme.styles.sectionTitle}>
                                {pageHeader}
                            </Text>
                            <Text style={this.theme.styles.sectionDescription}>
                                {this.translate('pages.forgotPassword.instructions')}
                            </Text>
                        </View>
                        <View style={this.themeAuthForm.styles.forgotPasswordInputsContainer}>
                            <RoundInput
                                autoCapitalize="none"
                                autoComplete="email"
                                autoCorrect={false}
                                placeholder={this.translate(
                                    'forms.forgotPassword.labels.email'
                                )}
                                value={inputs.email}
                                onChangeText={(text) =>
                                    this.onInputChange('email', text)
                                }
                                onSubmitEditing={this.onSubmit}
                                rightIcon={
                                    <FontAwesomeIcon
                                        name="envelope"
                                        size={22}
                                        color={this.theme.colors.primary3}
                                    />
                                }
                                themeForms={this.themeForms}
                            />
                            <Alert
                                containerStyles={addMargins({
                                    marginBottom: 24,
                                })}
                                isVisible={!!(errorMsg || successMsg)}
                                message={successMsg || errorMsg}
                                type={errorMsg ? 'error' : 'success'}
                                themeAlerts={this.themeAlerts}
                            />
                        </View>
                        <View style={this.themeAuthForm.styles.submitButtonContainer}>
                            <Button
                                buttonStyle={this.themeAuthForm.styles.button}
                                title={this.translate(
                                    'forms.forgotPassword.buttons.submit'
                                )}
                                onPress={this.onSubmit}
                                disabled={this.isFormDisabled()}
                            />
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ForgotPassword);
