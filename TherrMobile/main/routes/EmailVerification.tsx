import React from 'react';
import { SafeAreaView, ScrollView, View, Text, StatusBar } from 'react-native';
import { Button }  from 'react-native-elements';
import 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import styles, { addMargins } from '../styles';
import * as therrTheme from '../styles/themes';
import formStyles, { emailVerificationForm as emailVerificationFormStyles } from '../styles/forms';
import translator from '../services/translator';
import UsersActions from '../redux/actions/UsersActions';
import Alert from '../components/Alert';
import VerificationCodesService from '../services/VerificationCodesService';
import RoundInput from '../components/Input/Round';

interface IEmailVerificationDispatchProps {
    updateUser: Function;
}

interface IStoreProps extends IEmailVerificationDispatchProps {}

// Regular component props
export interface IEmailVerificationProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IEmailVerificationState {
    email: string;
    errorReason: string;
    isSubmitting: boolean;
    verificationStatus: string;
}

const mapStateToProps = () => ({});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateUser: UsersActions.update,
}, dispatch);

class EmailVerification extends React.Component<IEmailVerificationProps, IEmailVerificationState> {
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            email: '',
            errorReason: '',
            isSubmitting: false,
            verificationStatus: 'pending',
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { route, navigation } = this.props;
        const { verificationToken } = route.params;

        navigation.setOptions({
            title: this.translate('pages.emailVerification.headerTitle'),
        });

        VerificationCodesService.verifyEmail(verificationToken)
            .then(() => {
                this.setState({
                    verificationStatus: 'success',
                }, () => {
                    navigation.navigate('login', {
                        successMessage: this.translate('pages.emailVerification.successVerifiedMessage')
                    });
                });
            })
            .catch((error) => {
                if (error.message === 'Token has expired') {
                    this.setState({
                        errorReason: 'TokenExpired',
                    });
                }
                this.setState({
                    verificationStatus: 'failed',
                });
            })
            .finally(() => {
                this.setState({
                    isSubmitting: false,
                })
            });
    }

    isFormDisabled() {
        const { email, isSubmitting } = this.state;

        return !email || isSubmitting;
    }

    onSubmit = (event: any) => {
        event.preventDefault();

        const { navigation } = this.props;
        const { email } = this.state;

        VerificationCodesService.resendVerification(email)
            .then(() => {
                navigation.navigate('login', {
                    successMessage: this.translate('pages.emailVerification.failedMessageVerificationResent', {
                        email: email,
                    }),
                });
            })
            .catch((error) => {
                if (error.message === 'Email already verified') {
                    navigation.navigate('login', {
                        successMessage: this.translate('pages.emailVerification.failedMessageAlreadyVerified'),
                    });
                }

                if (error.message === 'User not found') {
                    this.setState({
                        errorReason: 'UserNotFound',
                    });
                }
            });
    }

    onInputChange = (name: string, value: string) => {
        this.setState({
            email: value,
        });
    }

    getErrorMessage = () => {
        const { errorReason, verificationStatus } = this.state;

        if (verificationStatus === 'pending') {

        } else if (verificationStatus === 'success') {
            // errorMessage = this.translate('pages.emailVerification.successMessage');
        } else if (verificationStatus === 'failed') {
            if (errorReason === 'TokenExpired') {
                return this.translate('pages.emailVerification.failedMessageExpired');
            }
            if (errorReason === 'UserNotFound') {
                return this.translate('pages.emailVerification.failedMessageUserNotFound');
            }

            return this.translate('pages.emailVerification.failedMessage');
        }

        return false;
    }

    render() {
        const { email } = this.state;
        const pageHeader = this.translate('pages.emailVerification.pageHeader');

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} backgroundColor="transparent"  />
                <SafeAreaView  style={styles.safeAreaView}>
                    <ScrollView style={styles.bodyFlex} contentContainerStyle={styles.bodyScrollSmall}>
                        <View style={styles.sectionContainerAlt}>
                            <Text style={styles.sectionTitle}>
                                {pageHeader}
                            </Text>
                            <Text style={styles.sectionDescription}>
                                {this.translate('pages.emailVerification.instructions')}
                            </Text>
                        </View>
                        <View style={emailVerificationFormStyles.inputsContainer}>
                            <RoundInput
                                autoCapitalize="none"
                                autoCompleteType="email"
                                placeholder={this.translate(
                                    'forms.emailVerification.labels.email'
                                )}
                                value={email}
                                onChangeText={(text) =>
                                    this.onInputChange('email', text)
                                }
                                onSubmitEditing={this.onSubmit}
                                rightIcon={
                                    <FontAwesomeIcon
                                        name="envelope"
                                        size={22}
                                        color={therrTheme.colors.primary3}
                                    />
                                }
                            />
                            <Alert
                                containerStyles={addMargins({
                                    marginBottom: 24,
                                })}
                                isVisible={!!this.getErrorMessage()}
                                message={this.getErrorMessage()}
                                type={'error'}
                            />
                        </View>
                        <View style={emailVerificationFormStyles.submitButtonContainer}>
                            <Button
                                buttonStyle={formStyles.button}
                                title={this.translate(
                                    'forms.emailVerification.buttons.send'
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

export default connect(mapStateToProps, mapDispatchToProps)(EmailVerification);
