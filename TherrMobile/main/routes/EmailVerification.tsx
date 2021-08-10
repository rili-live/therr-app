import React from 'react';
import { SafeAreaView, ScrollView, View, Text } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { Button }  from 'react-native-elements';
import 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import styles, { addMargins } from '../styles';
import * as therrTheme from '../styles/themes';
import formStyles, { verifyEmailForm as verifyEmailFormStyles } from '../styles/forms';
import translator from '../services/translator';
import UsersActions from '../redux/actions/UsersActions';
import Alert from '../components/Alert';
import VerificationCodesService from '../services/VerificationCodesService';
import RoundInput from '../components/Input/Round';
import EarthLoader from '../components/Loaders/EarthLoader';
import BaseStatusBar from '../components/BaseStatusBar';

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
        let verificationToken;

        navigation.setOptions({
            title: this.translate('pages.emailVerification.headerTitle'),
        });

        if (route.params) {
            verificationToken = route.params.verificationToken;

            VerificationCodesService.verifyEmail(verificationToken)
                .then(() => {
                    this.setState({
                        verificationStatus: 'success',
                    }, () => {
                        navigation.dispatch(
                            CommonActions.reset({
                                index: 1,
                                routes: [
                                    {
                                        name: 'Login',
                                        params: {
                                            userMessage: this.translate('pages.emailVerification.successVerifiedMessage'),
                                            isVerifySuccess: true,
                                        },
                                    },
                                ],
                            })
                        );
                        // navigation.navigate('Login', {
                        //     userMessage: this.translate('pages.emailVerification.successVerifiedMessage'),
                        // });
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
                    });
                });
        }
    }

    isFormDisabled() {
        const { email, isSubmitting } = this.state;

        return !email || isSubmitting;
    }

    onSubmit = () => {
        const { navigation } = this.props;
        const { email } = this.state;

        VerificationCodesService.resendVerification(email)
            .then(() => {
                navigation.dispatch(
                    CommonActions.reset({
                        index: 1,
                        routes: [
                            {
                                name: 'Login',
                                params: {
                                    userMessage: this.translate('pages.emailVerification.successVerifiedMessage'),
                                    isVerifySuccess: true,
                                },
                            },
                        ],
                    })
                );
                // navigation.navigate('Login', {
                //     userMessage: this.translate('pages.emailVerification.successVerifiedMessage'),
                // });
            })
            .catch((error) => {
                if (error.message === 'Email already verified') {
                    navigation.dispatch(
                        CommonActions.reset({
                            index: 1,
                            routes: [
                                {
                                    name: 'Login',
                                    params: {
                                        userMessage: this.translate('pages.emailVerification.failedMessageAlreadyVerified'),
                                        isVerifySuccess: true,
                                    },
                                },
                            ],
                        })
                    );
                    // navigation.navigate('Login', {
                    //     userMessage: this.translate('pages.emailVerification.failedMessageAlreadyVerified'),
                    // });
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
        const { email, verificationStatus } = this.state;
        const pageHeader = this.translate('pages.emailVerification.pageHeader');

        if (verificationStatus === 'pending') {
            return (
                <EarthLoader
                    visible={true}
                    speed={1.25}
                />
            );
        }

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView  style={styles.safeAreaView}>
                    <ScrollView style={styles.bodyFlex} contentContainerStyle={styles.bodyScrollSmall}>
                        <View style={styles.sectionContainerAlt}>
                            <Text style={styles.sectionTitle}>
                                {pageHeader}
                            </Text>
                        </View>
                        <View style={verifyEmailFormStyles.inputsContainer}>
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
                        <View style={verifyEmailFormStyles.submitButtonContainer}>
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
