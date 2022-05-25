import React from 'react';
import { SafeAreaView, View, Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Button }  from 'react-native-elements';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
// import { Picker as ReactPicker } from '@react-native-picker/picker';
import { IUserState } from 'therr-react/types';
// import { Content } from 'therr-js-utilities/constants';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
// import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
// import RNFB from 'rn-fetch-blob';
import Toast from 'react-native-toast-message';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
// import Alert from '../components/Alert';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildOAuthModalStyles } from '../../styles/modal/oauthModal';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildAlertStyles } from '../../styles/alerts';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildSettingsFormStyles } from '../../styles/forms/socialSyncForm';
import { buildStyles as buildUserStyles } from '../../styles/user-content/user-display';
import SquareInput from '../../components/Input/Square';
import BaseStatusBar from '../../components/BaseStatusBar';
import OAuthModal from '../../components/Modals/OAuthModal';
import SocialIconLink from './SocialIconLink';
// import UserImage from '../components/UserContent/UserImage';
// import { getUserImageUri, signImageUrl } from '../utilities/content';

const INSTAGRAM_APP_ID = '8038208602859743';

interface ISocialSyncDispatchProps {
    createUpdateSocialSyncs: Function;
    updateUser: Function;
}

interface IStoreProps extends ISocialSyncDispatchProps {
    user: IUserState;
}

// Regular component props
export interface ISocialSyncProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface ISocialSyncState {
    errorMsg: string;
    successMsg: string;
    inputs: any;
    isOAuthModalVisible: boolean;
    isSubmitting: boolean;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createUpdateSocialSyncs: UsersActions.createUpdateSocialSyncs,
    updateUser: UsersActions.update,
}, dispatch);

export class SocialSync extends React.Component<ISocialSyncProps, ISocialSyncState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeButtons = buildButtonStyles();
    private themeMenu = buildMenuStyles();
    private themeOAuthModal = buildOAuthModalStyles();
    private themeAlerts = buildAlertStyles();
    private themeForms = buildFormStyles();
    private themeSocialSyncForm = buildSettingsFormStyles();
    private themeUser = buildUserStyles();

    constructor(props) {
        super(props);

        const userInView = props.route?.params;

        this.state = {
            errorMsg: '',
            successMsg: '',
            inputs: {
                twitterHandle: userInView?.socialSyncs?.twitter?.platformUsername,
            },
            isOAuthModalVisible: false,
            isSubmitting: false,
        };

        this.reloadTheme();
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.translate('pages.socialSync.headerTitle'),
        });
    }

    isFormDisabled() {
        const { isSubmitting } = this.state;

        // TODO: Add message to show when passwords not equal
        return isSubmitting;
    }

    reloadTheme = () => {
        const themeName = this.props.user.settings?.mobileThemeName;

        this.theme = buildStyles(themeName);
        this.themeButtons = buildButtonStyles(themeName);
        this.themeMenu = buildMenuStyles(themeName);
        this.themeOAuthModal = buildOAuthModalStyles(themeName);
        this.themeAlerts = buildAlertStyles(themeName);
        this.themeForms = buildFormStyles(themeName);
        this.themeSocialSyncForm = buildSettingsFormStyles(themeName);
        this.themeUser = buildUserStyles(themeName);
    }

    onSubmit = (syncs) => {
        const { createUpdateSocialSyncs, navigation } = this.props;

        createUpdateSocialSyncs({
            syncs,
        }).then((response) => {
            console.log(response.data?.errors);
            const errorsByProvider = response.data?.errors || {};
            if (Object.keys(errorsByProvider).length) {
                const hasMatch = Object.keys(errorsByProvider).some((provider) => {
                    if (syncs.instagram && provider === 'instagram' && errorsByProvider[provider].type === 'IGApiException') {
                        Toast.show({
                            type: 'errorBig',
                            text1: 'Instagram',
                            text2: this.translate('forms.socialSync.errorAlerts.igNoBusinessAccounts'),
                        });
                        return true;
                    }
                    if (syncs.twitter && provider === 'twitter' && errorsByProvider[provider][0]?.title === 'Not Found Error') {
                        Toast.show({
                            type: 'errorBig',
                            text1: 'Instagram',
                            text2: this.translate('forms.socialSync.errorAlerts.twitterNotFound'),
                        });
                        return true;
                    }
                });
                if (!hasMatch) {
                    Toast.show({
                        type: 'errorBig',
                        text1: this.translate('forms.socialSync.errorTitles.oops'),
                        text2: this.translate('forms.socialSync.errorAlerts.unknownError'),
                    });
                }
            } else if (Object.keys(syncs).length) {
                Toast.show({
                    type: 'success',
                    text1: this.translate('forms.socialSync.successTitles.success'),
                    text2: this.translate('forms.socialSync.successAlerts.syncSuccess', {
                        providers: Object.keys(syncs).join(', '),
                    }),
                    visibilityTime: 2000,
                    onHide: () => navigation.goBack(),
                });
            }
        }).catch((err) => {
            console.log(err);
        });
    }

    onSaveInstagram = (syncs) => {
        this.onSubmit(syncs);
    };

    onSaveTwitter = () => {
        const { inputs } = this.state;

        this.onSubmit({
            twitter: {
                username: inputs.twitterHandle,
            },
        });
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
            errorMsg: '',
            successMsg: '',
            isSubmitting: false,
        });
    };

    onSocialLogin = () => {
        this.setState({
            isOAuthModalVisible: true,
        });
    }

    onCloseOAuthModal = () => {
        this.setState({
            isOAuthModalVisible: false,
        });
    }

    onOAuthLoginSuccess = (results) => {
        this.onCloseOAuthModal();
        this.onSaveInstagram({
            instagram: {
                accessToken: results.access_token,
                userId: results.user_id,
            },
        });
    }

    onOAuthLoginFailed = (response) => {
        this.onCloseOAuthModal();
        console.log('OAuthFailed: ', response);
    }


    render() {
        const { navigation, route, user } = this.props;
        const { isOAuthModalVisible, inputs } = this.state;
        const pageHeaderSocials = this.translate('pages.socialSync.pageHeaderSyncList');
        const descriptionText = this.translate('pages.socialSync.description');
        const userInView = route?.params;
        // const currentUserImageUri = getUserImageUri(user, 200);

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
                                    {pageHeaderSocials}
                                </Text>
                                <Text style={this.theme.styles.sectionDescriptionCentered}>
                                    {descriptionText}
                                </Text>
                            </View>
                            <View style={this.themeSocialSyncForm.styles.socialLinkContainer}>
                                <View style={{
                                    paddingRight: 16,
                                }}>
                                    <SocialIconLink
                                        iconName="instagram"
                                        isMe={true}
                                        navigation={navigation}
                                        themeUser={this.themeUser}
                                        userInView={userInView}
                                    />
                                </View>
                                <Button
                                    containerStyle={[{ flex: 1 }]}
                                    buttonStyle={[this.themeForms.styles.buttonRoundAlt]}
                                    titleStyle={this.themeForms.styles.buttonTitleAlt}
                                    title={this.translate('forms.socialSync.buttons.syncInstagram')}
                                    // icon={
                                    //     <FontAwesome5Icon
                                    //         name="sync"
                                    //         size={22}
                                    //         style={this.themeForms.styles.buttonIconAlt}
                                    //     />
                                    // }
                                    raised={false}
                                    onPress={this.onSocialLogin}
                                />
                            </View>
                            <View style={this.themeSocialSyncForm.styles.socialLinkContainer}>
                                <View style={{
                                    paddingRight: 16,
                                }}>
                                    <SocialIconLink
                                        iconName="twitter"
                                        isMe={true}
                                        navigation={navigation}
                                        themeUser={this.themeUser}
                                        userInView={userInView}
                                    />
                                </View>
                                <SquareInput
                                    containerStyle={{ flex: 1 }}
                                    labelStyle={this.themeForms.styles.inputLabelLightFaded}
                                    value={inputs.twitterHandle}
                                    onChangeText={(text) =>
                                        this.onInputChange('twitterHandle', text)
                                    }
                                    placeholder={this.translate(
                                        'forms.socialSync.placeholders.twitterHandle'
                                    )}
                                    themeForms={this.themeForms}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                <Button
                                    containerStyle={[]}
                                    buttonStyle={[this.themeForms.styles.buttonRoundAlt]}
                                    titleStyle={this.themeForms.styles.buttonTitleAlt}
                                    title={this.translate('forms.socialSync.buttons.sync')}
                                    // icon={
                                    //     <FontAwesome5Icon
                                    //         name="sync"
                                    //         size={22}
                                    //         style={this.themeForms.styles.buttonIconAlt}
                                    //     />
                                    // }
                                    onPress={this.onSaveTwitter}
                                />
                            </View>
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
                <View style={this.themeSocialSyncForm.styles.submitButtonContainerFloat}>
                    <Button
                        buttonStyle={this.themeForms.styles.button}
                        titleStyle={this.themeForms.styles.buttonTitle}
                        title={this.translate(
                            'forms.socialSync.buttons.backToProfile'
                        )}
                        icon={
                            <FontAwesome5Icon
                                name="arrow-left"
                                size={22}
                                style={this.themeForms.styles.buttonIcon}
                            />
                        }
                        onPress={navigation.goBack}
                        raised={true}
                    />
                </View>
                <OAuthModal
                    appId={INSTAGRAM_APP_ID}
                    onRequestClose={this.onCloseOAuthModal}
                    onLoginSuccess={this.onOAuthLoginSuccess}
                    onLoginFailure={this.onOAuthLoginFailed}
                    // Note: This must match the redirect url on the backend
                    backendRedirectUrl="https://api.therr.com/v1/users-service/social-sync/oauth2-instagram"
                    frontendRedirectUrl="https://therr.com"
                    responseType="code"
                    scopes={['user_profile', 'user_media']}
                    isVisible={isOAuthModalVisible}
                    language="en"
                    incognito={false}
                    themeModal={this.themeOAuthModal}
                />
                <MainButtonMenu
                    navigation={navigation}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(SocialSync);
