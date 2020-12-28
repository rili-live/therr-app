import React from 'react';
import { SafeAreaView, ScrollView, View, Text, StatusBar } from 'react-native';
import { Button, Input }  from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import styles from '../styles';
import * as therrTheme from '../styles/themes';
import formStyles, { forgotPasswordForm as forgotPasswordFormStyles } from '../styles/forms';
import translator from '../services/translator';
import UsersActions from '../redux/actions/UsersActions';
import Alert from '../components/Alert';
import VerificationCodesService from '../services/VerificationCodesService';

interface IForgotPasswordDispatchProps {
    updateUser: Function;
}

interface IStoreProps extends IForgotPasswordDispatchProps {}

// Regular component props
export interface IForgotPasswordProps extends IStoreProps {
    navigation: any;
}

interface IForgotPasswordState {
    errorMsg: string;
    successMsg: string;
    inputs: any;
    isSubmitting: boolean;
}

const mapStateToProps = () => ({});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateUser: UsersActions.update,
}, dispatch);

class ForgotPassword extends React.Component<IForgotPasswordProps, IForgotPasswordState> {
    private scrollViewRef;
    private translate: Function;

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
            VerificationCodesService.requestOneTimePassword(email)
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

        if (name === 'userName') {
            newInputChanges[name] = value.toLowerCase();
        }

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
                <StatusBar barStyle="light-content" animated={true} translucent={true} />
                <SafeAreaView>
                    <ScrollView style={styles.bodyFlex} contentContainerStyle={styles.bodyScrollSmall}>
                        <View style={styles.sectionContainerAlt}>
                            <Text style={styles.sectionDescription}>
                                {pageHeader}
                            </Text>
                            <Text style={styles.sectionDescription}>
                                {this.translate('pages.forgotPassword.instructions')}
                            </Text>
                        </View>
                        <View style={forgotPasswordFormStyles.inputsContainer}>
                            <Input
                                inputStyle={formStyles.input}
                                inputContainerStyle={formStyles.inputContainer}
                                placeholder={this.translate(
                                    'forms.forgotPassword.labels.email'
                                )}
                                value={inputs.email}
                                onChangeText={(text) =>
                                    this.onInputChange('email', text)
                                }
                                selectionColor={therrTheme.colors.ternary}
                            />
                            <Alert
                                containerStyles={{
                                    marginBottom: 24,
                                }}
                                isVisible={!!(errorMsg || successMsg)}
                                message={successMsg || errorMsg}
                                type={errorMsg ? 'error' : 'success'}
                            />
                        </View>
                        <View style={forgotPasswordFormStyles.submitButtonContainer}>
                            <Button
                                buttonStyle={formStyles.button}
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
