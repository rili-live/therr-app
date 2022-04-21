import React from 'react';
import { SafeAreaView, Share, View, Text } from 'react-native';
import { Button } from 'react-native-elements';
// import { Picker as ReactPicker } from '@react-native-picker/picker';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import { FlatList } from 'react-native-gesture-handler';
import Contacts from 'react-native-contacts';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import isEmail from 'validator/es/lib/isEmail';
import Alert from '../components/Alert';
import MainButtonMenu from '../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../redux/actions/UsersActions';
import translator from '../services/translator';
// import SquareInput from '../components/Input/Square';
import RoundInput from '../components/Input/Round';
import PhoneNumberInput from '../components/Input/PhoneNumberInput';
import { buildStyles, addMargins } from '../styles';
import { buildStyles as buildAlertStyles } from '../styles/alerts';
import { buildStyles as buildButtonStyles } from '../styles/buttons';
import { buildStyles as buildConfirmModalStyles } from '../styles/modal/confirmModal';
import { buildStyles as buildMenuStyles } from '../styles/navigation/buttonMenu';
import { buildStyles as buildFormStyles } from '../styles/forms';
import BaseStatusBar from '../components/BaseStatusBar';
import MessagesContactsTabs from '../components/FlatListHeaderTabs/MessagesContactsTabs';
import ConfirmModal from '../components/Modals/ConfirmModal';
import { DEFAULT_FIRSTNAME, DEFAULT_LASTNAME } from '../constants';
import OrDivider from '../components/Input/OrDivider';
import { requestOSContactsPermissions } from '../utilities/requestOSPermissions';

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
    private theme = buildStyles();
    private themeAlerts = buildAlertStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeButtons = buildButtonStyles();
    private themeMenu = buildMenuStyles();
    private themeForms = buildFormStyles();

    constructor(props) {
        super(props);

        this.state = {
            connectionContext: 'email',
            didIgnoreNameConfirm: false,
            emailErrorMessage: '',
            inputs: {},
            prevConnReqError: '',
            prevConnReqSuccess: '',
            isPhoneNumberValid: false,
            isSubmitting: false,
            isNameConfirmModalVisible: false,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeAlerts = buildAlertStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeConfirmModal = buildConfirmModalStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
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
            requestingUserEmail: user.details.email?.toLowerCase(),
        };

        if (connectionContext === 'email') {
            reqBody.acceptingUserEmail = inputs.email?.toLowerCase();
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

    onGetPhoneContacts = () => {
        const { navigation } = this.props;
        const { didIgnoreNameConfirm } = this.state;
        // TODO: Store permissions in redux
        const storePermissions = () => {};

        if (!didIgnoreNameConfirm && this.isUserNameAnonymous()) {
            this.toggleNameConfirmModal();
            return;
        }

        return requestOSContactsPermissions(storePermissions).then((response) => {
            const permissionsDenied = Object.keys(response).some((key) => {
                return response[key] !== 'granted';
            });
            if (!permissionsDenied) {
                return Contacts.getAll().then(contacts => {
                    // contacts returned

                    navigation.navigate('PhoneContacts', {
                        allContacts: contacts,
                    });
                });
            }
        });
    }

    onShareALink = () => {
        Share.share({
            message: this.translate('forms.createConnection.shareLink.message'),
            url: 'https://therr.app',
            title: this.translate('forms.createConnection.shareLink.title'),
        }).then((response) => {
            if (response.action === Share.sharedAction) {
                if (response.activityType) {
                    // shared with activity type of response.activityType
                } else {
                    // shared
                }
            } else if (response.action === Share.dismissedAction) {
                // dismissed
            }
        }).catch((err) => {
            console.error(err);
        });
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
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <FlatList
                        data={[{}]}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={() => (
                            <View style={this.theme.styles.body}>
                                <View style={this.theme.styles.sectionContainer}>
                                    <Text style={[this.theme.styles.sectionTitle, { marginBottom: 15 }]}>
                                        {this.translate('pages.userProfile.h2.createConnection')}
                                    </Text>
                                    <Text style={[this.theme.styles.sectionDescription, { marginBottom: 25 }]}>
                                        {this.translate('pages.userProfile.subtitles.createConnection')}
                                    </Text>
                                    <View style={this.theme.styles.sectionForm}>
                                        {/* <ReactPicker
                                            selectedValue={connectionContext}
                                            style={this.themeForms.styles.picker}
                                            itemStyle={this.themeForms.styles.pickerItem}
                                            onValueChange={(itemValue) =>
                                                this.setState({ connectionContext: itemValue })
                                            }>
                                            <ReactPicker.Item label={this.translate(
                                                'forms.createConnection.labels.email'
                                            )} value="email" />
                                            <ReactPicker.Item label={this.translate(
                                                'forms.createConnection.labels.phone'
                                            )} value="phone" />
                                        </ReactPicker> */}
                                        {
                                            connectionContext === 'email' &&
                                            <RoundInput
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
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                rightIcon={
                                                    <FontAwesomeIcon
                                                        name="envelope"
                                                        size={22}
                                                        color={this.theme.colorVariations.primary3Fade}
                                                    />
                                                }
                                                themeForms={this.themeForms}
                                            />
                                        }
                                        {
                                            connectionContext === 'phone' &&
                                            <PhoneNumberInput
                                                onChangeText={this.onPhoneInputChange}
                                                onSubmit={this.onSubmit}
                                                placeholder={this.translate('forms.settings.labels.phoneNumber')}
                                                translate={this.translate}
                                                theme={this.theme}
                                                themeForms={this.themeForms}
                                            />
                                        }
                                        <Button
                                            buttonStyle={this.themeForms.styles.buttonRound}
                                            // disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                                            disabledStyle={this.themeForms.styles.buttonRoundDisabled}
                                            disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                                            titleStyle={this.themeForms.styles.buttonTitle}
                                            title={this.translate(
                                                'forms.createConnection.buttons.submit'
                                            )}
                                            onPress={this.onSubmit}
                                            disabled={this.isConnReqFormDisabled()}
                                            raised={false}
                                        />
                                        <Alert
                                            containerStyles={addMargins({
                                                marginTop: 24,
                                            })}
                                            isVisible={!!prevConnReqSuccess || !!prevConnReqError}
                                            message={!!prevConnReqSuccess ? prevConnReqSuccess : prevConnReqError}
                                            type={!!prevConnReqSuccess ? 'success' : 'error'}
                                            themeAlerts={this.themeAlerts}
                                        />
                                        <OrDivider
                                            translate={this.translate}
                                            themeForms={this.themeForms}
                                            containerStyle={{ marginVertical: 30 }}
                                        />
                                        <Button
                                            containerStyle={{ marginBottom: 20 }}
                                            buttonStyle={this.themeForms.styles.buttonRoundAlt}
                                            // disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                                            disabledStyle={this.themeForms.styles.buttonRoundDisabled}
                                            disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                                            titleStyle={this.themeForms.styles.buttonTitleAlt}
                                            title={this.translate(
                                                'forms.createConnection.buttons.invitePhoneContacts'
                                            )}
                                            type="outline"
                                            onPress={this.onGetPhoneContacts}
                                            raised={false}
                                        />
                                        <Button
                                            containerStyle={{ marginBottom: 10 }}
                                            buttonStyle={this.themeForms.styles.buttonRoundAlt}
                                            // disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                                            disabledStyle={this.themeForms.styles.buttonRoundDisabled}
                                            disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                                            titleStyle={this.themeForms.styles.buttonTitleAlt}
                                            title={this.translate(
                                                'forms.createConnection.buttons.shareALink'
                                            )}
                                            type="outline"
                                            onPress={this.onShareALink}
                                            raised={false}
                                        />
                                    </View>
                                    <Text style={[this.theme.styles.sectionDescription, { textAlign: 'center', fontSize: 12 }]}>
                                        {this.translate('pages.userProfile.subtitles.whoInviteDisclaimer')}
                                    </Text>
                                </View>
                            </View>
                        )}
                        ListHeaderComponent={() => (
                            <MessagesContactsTabs
                                tabName="CreateConnection"
                                navigation={navigation}
                                translate={this.translate}
                                containerStyles={this.themeMenu.styles.tabsContainer}
                                themeMenu={this.themeMenu}
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
                    theme={this.theme}
                    themeModal={this.themeConfirmModal}
                    themeButtons={this.themeButtons}
                />
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
