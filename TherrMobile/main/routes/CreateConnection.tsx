import React from 'react';
import { SafeAreaView, ScrollView, View, Text, StatusBar } from 'react-native';
import { Button } from 'react-native-elements';
import { Picker as ReactPicker } from '@react-native-picker/picker';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import isEmail from 'validator/es/lib/isEmail';
import Alert from '../components/Alert';
import MainButtonMenu from '../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../redux/actions/UsersActions';
import translator from '../services/translator';
import SquareInput from '../components/Input/Square';
import PhoneNumberInput from '../components/Input/PhoneNumberInput';
import * as therrTheme from '../styles/themes';
import styles, { addMargins } from '../styles';
import formStyles from '../styles/forms';

interface IHomeDispatchProps {
    createUserConnection: Function;
    logout: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IHomeDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IHomeProps extends IStoreProps {
    navigation: any;
}

interface IHomeState {
    connectionContext: any;
    emailErrorMessage: string;
    inputs: any;
    isPhoneNumberValid: boolean;
    prevConnReqSuccess: string;
    prevConnReqError: string;
    isSubmitting: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            createUserConnection: UserConnectionsActions.create,
            logout: UsersActions.logout,
            searchUserConnections: UserConnectionsActions.search,
        },
        dispatch
    );

class Home extends React.Component<IHomeProps, IHomeState> {
    private translate: Function;

    private quote: string;

    private quoteAuthor: string;

    constructor(props) {
        super(props);

        this.state = {
            connectionContext: 'phone',
            emailErrorMessage: '',
            inputs: {},
            prevConnReqError: '',
            prevConnReqSuccess: '',
            isPhoneNumberValid: false,
            isSubmitting: false,
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);

        const quote = this.translate('quoteOfTheDay');
        const quoteSplit = quote.split(' - ');
        this.quote = quoteSplit[0];
        this.quoteAuthor = quoteSplit[1];
    }

    componentDidMount() {
        const { navigation, user, userConnections } = this.props;

        navigation.setOptions({
            title: 'Therr',
        });

        if (!userConnections.connections.length) {
            this.props
                .searchUserConnections(
                    {
                        filterBy: 'acceptingUserId',
                        query: user.details && user.details.id,
                        itemsPerPage: 50,
                        pageNumber: 1,
                        orderBy: 'interactionCount',
                        order: 'desc',
                        shouldCheckReverse: true,
                    },
                    user.details && user.details.id
                )
                .catch(() => {});
        }
    }

    getConnectionDetails = (connection) => {
        const { user } = this.props;

        // Active connection format
        if (!connection.users) {
            return connection;
        }

        // User <-> User connection format
        return (
            connection.users.find(
                (u) => user.details && u.id !== user.details.id
            ) || {}
        );
    };

    getConnectionSubtitle = (connectionDetails) => {
        return `${connectionDetails.firstName || ''} ${
            connectionDetails.lastName || ''
        }`;
    };

    isConnReqFormDisabled = () => {
        const { connectionContext } = this.state;

        return connectionContext === 'email' && !this.isEmailValid();
    };

    isEmailValid = () => {
        return isEmail(this.state.inputs.email || '');
    }

    onConnectionPress = (connectionDetails) => {
        const { navigation } = this.props;

        navigation.navigate('DirectMessage', {
            connectionDetails,
        });
    };

    onInputChange = (name: string, value: string) => {
        let emailErrorMessage = '';

        const newInputChanges = {
            [name]: value,
        };

        if (name === 'email') {
            if (!this.isEmailValid()) {
                emailErrorMessage = this.translate('forms.createConnection.errorMessages.invalidEmail');
            }
        }

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            emailErrorMessage,
            prevConnReqError: '',
            prevConnReqSuccess: '',
            isSubmitting: false,
        });
    };

    onBlurValidate = () => {
        let emailErrorMessage = '';

        if (!this.isEmailValid()) {
            emailErrorMessage = this.translate('forms.createConnection.errorMessages.invalidEmail');
        }

        this.setState({
            emailErrorMessage,
        });
    }

    onSubmit = () => {
        const { connectionContext, inputs, isPhoneNumberValid } = this.state;
        const { createUserConnection, user } = this.props;

        if (connectionContext === 'phone' && !isPhoneNumberValid) {
            this.setState({
                prevConnReqError: this.translate('forms.createConnection.errorMessages.invalidPhoneNumber'),
            });
            return;
        }

        const reqBody: any = {
            requestingUserId: user.details.id,
            requestingUserFirstName: user.details.firstName,
            requestingUserLastName: user.details.lastName,
        };

        if (connectionContext === 'email') {
            reqBody.acceptingUserEmail = inputs.email;
        }
        if (connectionContext === 'phone') {
            reqBody.acceptingUserPhoneNumber = inputs.phoneNumber;
        }

        createUserConnection(reqBody, user.details)
            .then(() => {
                this.setState({
                    inputs: {
                        email: '',
                        phoneNumber: '',
                    },
                    prevConnReqSuccess: this.translate('forms.createConnection.successMessages.connectionSent'),
                });
            })
            .catch((error) => {
                if (error.statusCode === 400 || error.statusCode === 404) {
                    this.setState({
                        prevConnReqError: error.message,
                    });
                }
            });
    };

    onPhoneInputChange = (value: string, isValid: boolean) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                phoneNumber: value,
            },
            prevConnReqError: '',
            prevConnReqSuccess: '',
            isPhoneNumberValid: isValid,
        });
    }

    render() {
        const {
            connectionContext,
            emailErrorMessage,
            inputs,
            prevConnReqError,
            prevConnReqSuccess,
        } = this.state;
        const { navigation, user } = this.props;

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} backgroundColor="transparent"  />
                <SafeAreaView style={styles.safeAreaView}>
                    <ScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        style={styles.scrollView}
                    >
                        <View style={styles.body}>
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionTitle}>
                                    {this.translate('pages.userProfile.h2.createConnection')}
                                </Text>
                                <View style={styles.sectionForm}>
                                    <ReactPicker
                                        selectedValue={connectionContext}
                                        style={formStyles.picker}
                                        itemStyle={formStyles.pickerItem}
                                        onValueChange={(itemValue) =>
                                            this.setState({ connectionContext: itemValue })
                                        }>
                                        <ReactPicker.Item label={this.translate(
                                            'forms.createConnection.labels.phone'
                                        )} value="phone" />
                                        <ReactPicker.Item label={this.translate(
                                            'forms.createConnection.labels.email'
                                        )} value="email" />
                                    </ReactPicker>
                                    {
                                        connectionContext === 'email' &&
                                        <SquareInput
                                            placeholder={this.translate(
                                                'forms.createConnection.placeholders.email'
                                            )}
                                            value={inputs.email}
                                            onChangeText={(text) =>
                                                this.onInputChange('email', text)
                                            }
                                            onBlur={this.onBlurValidate}
                                            onSubmitEditing={() => this.onSubmit()}
                                            errorMessage={emailErrorMessage}
                                            rightIcon={
                                                <FontAwesomeIcon
                                                    name="envelope"
                                                    size={22}
                                                    color={therrTheme.colors.primary3Faded}
                                                />
                                            }
                                        />
                                    }
                                    {
                                        connectionContext === 'phone' &&
                                        <PhoneNumberInput
                                            onChangeText={this.onPhoneInputChange}
                                            onSubmit={this.onSubmit}
                                            placeholder={this.translate('forms.settings.labels.phoneNumber')}
                                            translate={this.translate}
                                        />
                                    }
                                    <Alert
                                        containerStyles={addMargins({
                                            marginBottom: 24,
                                        })}
                                        isVisible={!!prevConnReqError}
                                        message={prevConnReqError}
                                        type={'error'}
                                    />
                                    <Alert
                                        containerStyles={addMargins({
                                            marginBottom: 24,
                                        })}
                                        isVisible={!!prevConnReqSuccess}
                                        message={prevConnReqSuccess}
                                        type={'success'}
                                    />
                                    <Button
                                        containerStyle={addMargins({
                                            marginBottom: 18,
                                        })}
                                        buttonStyle={formStyles.button}
                                        disabledTitleStyle={formStyles.buttonTitleDisabled}
                                        disabledStyle={formStyles.buttonDisabled}
                                        title={this.translate(
                                            'forms.createConnection.buttons.submit'
                                        )}
                                        onPress={this.onSubmit}
                                        disabled={this.isConnReqFormDisabled()}
                                        raised={true}
                                    />
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </SafeAreaView>
                <MainButtonMenu navigation={navigation} translate={this.translate} user={user} />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Home);
