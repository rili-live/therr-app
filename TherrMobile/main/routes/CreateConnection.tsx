import React from 'react';
import { SafeAreaView, View, Text } from 'react-native';
import { Button } from 'react-native-elements';
import { Picker as ReactPicker } from '@react-native-picker/picker';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import { FlatList } from 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import isEmail from 'validator/es/lib/isEmail';
import Alert from '../components/Alert';
import MainButtonMenuAlt from '../components/ButtonMenu/MainButtonMenuAlt';
import UsersActions from '../redux/actions/UsersActions';
import translator from '../services/translator';
import SquareInput from '../components/Input/Square';
import PhoneNumberInput from '../components/Input/PhoneNumberInput';
import * as therrTheme from '../styles/themes';
import styles, { addMargins } from '../styles';
import formStyles from '../styles/forms';
import BaseStatusBar from '../components/BaseStatusBar';
import MessagesContactsTabs from '../components/FlatListHeaderTabs/MessagesContactsTabs';
import ConfirmModal from '../components/Modals/ConfirmModal';
import { DEFAULT_FIRSTNAME, DEFAULT_LASTNAME } from '../constants';

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
    didIgnoreNameConfirm: boolean;
    emailErrorMessage: string;
    inputs: any;
    isPhoneNumberValid: boolean;
    prevConnReqSuccess: string;
    prevConnReqError: string;
    isSubmitting: boolean;
    isNameConfirmModalVisible: boolean;
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

    constructor(props) {
        super(props);

        this.state = {
            connectionContext: 'phone',
            didIgnoreNameConfirm: false,
            emailErrorMessage: '',
            inputs: {},
            prevConnReqError: '',
            prevConnReqSuccess: '',
            isPhoneNumberValid: false,
            isSubmitting: false,
            isNameConfirmModalVisible: false,
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { navigation, user, userConnections } = this.props;

        navigation.setOptions({
            title: this.translate('pages.activeConnections.headerTitle'),
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
            newInputChanges[name] = value.toLowerCase();
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

    isUserNameAnonymous = () => {
        const { user } = this.props;

        return user.details.firstName === DEFAULT_FIRSTNAME && user.details.lastName === DEFAULT_LASTNAME;
    }

    onSubmit = () => {
        const { connectionContext, didIgnoreNameConfirm, inputs, isPhoneNumberValid } = this.state;
        const { createUserConnection, user } = this.props;

        if (!didIgnoreNameConfirm && this.isUserNameAnonymous()) {
            this.toggleNameConfirmModal();
            return;
        }

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

    handleRefresh = () => {
        console.log('refresh');
    }

    toggleNameConfirmModal = () => {
        this.setState({
            didIgnoreNameConfirm: true,
            isNameConfirmModalVisible: !this.state.isNameConfirmModalVisible,
        });
    }

    handleNameConfirm = () => {
        const { navigation } = this.props;

        this.toggleNameConfirmModal();
        navigation.navigate('Settings');
    }

    render() {
        const {
            connectionContext,
            emailErrorMessage,
            inputs,
            isNameConfirmModalVisible,
            prevConnReqError,
            prevConnReqSuccess,
        } = this.state;
        const { navigation, user } = this.props;

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView style={styles.safeAreaView}>
                    <FlatList
                        data={[{}]}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={() => (
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
                                                        color={therrTheme.colorVariations.primary3Fade}
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
                                            isVisible={!!prevConnReqSuccess || !!prevConnReqError}
                                            message={!!prevConnReqSuccess ? prevConnReqSuccess : prevConnReqError}
                                            type={!!prevConnReqSuccess ? 'success' : 'error'}
                                        />
                                        <Button
                                            buttonStyle={formStyles.button}
                                            // disabledTitleStyle={formStyles.buttonTitleDisabled}
                                            disabledStyle={formStyles.buttonDisabled}
                                            title={this.translate(
                                                'forms.createConnection.buttons.submit'
                                            )}
                                            onPress={this.onSubmit}
                                            disabled={this.isConnReqFormDisabled()}
                                            raised={false}
                                        />
                                    </View>
                                </View>
                            </View>
                        )}
                        ListHeaderComponent={() => (
                            <MessagesContactsTabs
                                tabName="CreateConnection"
                                navigation={navigation}
                                translate={this.translate}
                            />
                        )}
                        stickyHeaderIndices={[0]}
                        // onContentSizeChange={() => connections.length && flatListRef.scrollToOffset({ animated: true, offset: 0 })}
                    />
                </SafeAreaView>
                <ConfirmModal
                    isVisible={isNameConfirmModalVisible}
                    onCancel={this.toggleNameConfirmModal}
                    onConfirm={this.handleNameConfirm}
                    text={this.translate('forms.createConnection.modal.nameConfirm')}
                    textCancel={this.translate('forms.createConnection.modal.noThanks')}
                    translate={this.translate}
                />
                <MainButtonMenuAlt
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Home);
