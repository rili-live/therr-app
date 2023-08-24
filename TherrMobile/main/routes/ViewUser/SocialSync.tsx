import React from 'react';
import { Linking, SafeAreaView, View, Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Button }  from 'react-native-elements';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import uuid from 'react-native-uuid';
// import { Picker as ReactPicker } from '@react-native-picker/picker';
import { IUserState } from 'therr-react/types';
import { MapActions } from 'therr-react/redux/actions';
// import { Content } from 'therr-js-utilities/constants';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
// import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
// import RNFB from 'react-native-blob-util';
import Toast from 'react-native-toast-message';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
// import Alert from '../components/Alert';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildModalStyles } from '../../styles/modal';
import { buildStyles as buildOAuthModalStyles } from '../../styles/modal/oauthModal';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildSettingsFormStyles } from '../../styles/forms/socialSyncForm';
import { buildStyles as buildUserStyles } from '../../styles/user-content/user-display';
import spacingStyles from '../../styles/layouts/spacing';
import SquareInput from '../../components/Input/Square';
import BaseStatusBar from '../../components/BaseStatusBar';
import WrapperModal from '../../components/Modals/WrapperModal';
import OAuthModal from '../../components/Modals/OAuthModal';
import SocialIconLink from './SocialIconLink';
import TherrIcon from '../../components/TherrIcon';
// import UserImage from '../components/UserContent/UserImage';
// import { getUserImageUri, signImageUrl } from '../utilities/content';

const INSTAGRAM_BASIC_DISPLAY_APP_ID = '8038208602859743';
const INSTAGRAM_GRAPH_API_APP_ID = '538207404468066';
const TIKTOK_CLIENT_KEY = 'awrccvgslbslon9t';

interface ISocialSyncDispatchProps {
    createUpdateSocialSyncs: Function;
    createIntegratedMoment: Function;
    getIntegratedMoments: Function;
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
    activeProvider: 'instagram' | 'facebook-instagram' | 'tiktok';
    inputs: any;
    isOAuthModalVisible: boolean;
    isAccountTypeModalVisible: boolean;
    isSubmitting: boolean;
    oAuthAppId: string;
    oAuthScopes: any;
    requestId: string;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createUpdateSocialSyncs: UsersActions.createUpdateSocialSyncs,
    createIntegratedMoment: MapActions.createIntegratedMoment,
    getIntegratedMoments: MapActions.getIntegratedMoments,
    updateUser: UsersActions.update,
}, dispatch);

export class SocialSync extends React.Component<ISocialSyncProps, ISocialSyncState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();
    private themeModal = buildModalStyles();
    private themeOAuthModal = buildOAuthModalStyles();
    private themeForms = buildFormStyles();
    private themeSocialSyncForm = buildSettingsFormStyles();
    private themeUser = buildUserStyles();

    constructor(props) {
        super(props);

        const userInView = props.route?.params;

        this.state = {
            activeProvider: 'instagram',
            inputs: {
                twitterHandle: userInView?.socialSyncs?.twitter?.platformUsername,
                youtubeChannelId: userInView?.socialSyncs?.youtube?.platformUsername,
            },
            isOAuthModalVisible: false,
            isAccountTypeModalVisible: false,
            isSubmitting: false,
            oAuthAppId: INSTAGRAM_BASIC_DISPLAY_APP_ID,
            oAuthScopes: ['user_profile', 'user_media'],
            requestId: uuid.v4().toString(),
        };

        this.reloadTheme();
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { navigation, route } = this.props;
        const authResult = route?.params?.authResult;
        if (authResult) {
            if (authResult.error) {
                this.setState({
                    activeProvider: authResult.provider,
                }, () => this.onOAuthLoginFailed(authResult));
            } else {
                this.setState({
                    activeProvider: authResult.provider,
                }, () => this.onOAuthLoginSuccess(authResult));
            }
        }
        navigation.setOptions({
            title: this.translate('pages.socialSync.headerTitle'),
        });
    }

    isFormDisabled() {
        const { isSubmitting } = this.state;

        return isSubmitting;
    }

    reloadTheme = () => {
        const themeName = this.props.user.settings?.mobileThemeName;

        this.theme = buildStyles(themeName);
        this.themeMenu = buildMenuStyles(themeName);
        this.themeModal = buildModalStyles(themeName);
        this.themeOAuthModal = buildOAuthModalStyles(themeName);
        this.themeForms = buildFormStyles(themeName);
        this.themeSocialSyncForm = buildSettingsFormStyles(themeName);
        this.themeUser = buildUserStyles(themeName);
    };

    onSubmit = (syncs) => {
        const { activeProvider } = this.state;
        const { createUpdateSocialSyncs, createIntegratedMoment, getIntegratedMoments, navigation, user } = this.props;

        const goBack = () => navigation.navigate('ViewUser', {
            userInView: {
                id: user.details.id,
            },
        });

        createUpdateSocialSyncs({
            syncs,
        }).then((response) => {
            let isOnHideComplete = false;
            let isPromiseComplete = false;
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
                if (response?.data?.instagramMedia) {
                    const promises: Promise<any>[] = [Promise.resolve()];
                    response?.data?.instagramMedia.data?.forEach((el) => {
                        if (activeProvider === 'instagram') {
                            promises.push(createIntegratedMoment('instagram', syncs.instagram.accessToken, el.id));
                        }
                        if (activeProvider === 'facebook-instagram') {
                            promises.push(createIntegratedMoment('facebook-instagram', syncs['facebook-instagram'].accessToken, el.id));
                        }
                    });
                    Promise.all(promises)
                        .then(() => {
                            return getIntegratedMoments(user.details.id);
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                        .finally(() => {
                            if (isOnHideComplete) {
                                goBack();
                            } else {
                                isPromiseComplete = true;
                            }
                        });
                } else {
                    isPromiseComplete = true;
                }

                Toast.show({
                    type: 'success',
                    text1: this.translate('forms.socialSync.successTitles.success'),
                    text2: this.translate('forms.socialSync.successAlerts.syncSuccess', {
                        providers: Object.keys(syncs).join(', '),
                    }),
                    visibilityTime: 2000,
                    onHide: () => {
                        if (isPromiseComplete) {
                            goBack();
                        } else {
                            isOnHideComplete = true;
                        }
                    },
                });
            }
        }).catch((err) => {
            console.log(err);
        });
    };

    onSaveFacebook = (syncs) => {
        this.onSubmit(syncs);
    };

    onSaveTikTok = (syncs) => {
        this.onSubmit(syncs);
    };

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

    onSaveYoutube = () => {
        const { inputs } = this.state;

        this.onSubmit({
            youtube: {
                username: inputs.youtubeChannelId,
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
            isSubmitting: false,
        });
    };

    onSocialLogin = (provider: 'instagram' | 'twitter' | 'tiktok') => {
        if (provider === 'instagram') {
            this.setState({
                isAccountTypeModalVisible: true,
            });
        } else if (provider === 'tiktok') {
            this.onTikTokSocialLogin();
        } else {
            this.setState({
                isOAuthModalVisible: true,
            });
        }
    };

    onCloseAccountTypeModal = () => {
        this.setState({
            isAccountTypeModalVisible: false,
        });
    };

    onCloseOAuthModal = () => {
        this.setState({
            isOAuthModalVisible: false,
        });
    };

    onSelectMetaAccountType = (type: 'personal' | 'business') => {
        const { requestId } = this.state;
        this.onCloseAccountTypeModal();
        if (type === 'personal') {
            this.setState({
                activeProvider: type === 'personal' ? 'instagram' : 'facebook-instagram',
                isOAuthModalVisible: true,
                oAuthAppId: type === 'personal' ? INSTAGRAM_BASIC_DISPLAY_APP_ID : INSTAGRAM_GRAPH_API_APP_ID,
                oAuthScopes: type === 'personal'
                    ? ['user_profile', 'user_media']
                    : ['public_profile', 'instagram_basic', 'pages_show_list', 'pages_read_engagement'],
            });
        } else {
            const appId = INSTAGRAM_GRAPH_API_APP_ID;
            const backendRedirectUrl = 'https://api.therr.com/v1/users-service/social-sync/oauth2-facebook';
            const responseType = 'code';
            // const scopes = ['public_profile', 'instagram_basic', 'instagram_manage_insights', 'pages_show_list', 'pages_read_engagement'];
            const scopes = ['public_profile', 'instagram_basic', 'pages_show_list', 'pages_read_engagement'];
            // eslint-disable-next-line max-len
            Linking.openURL(`https://www.facebook.com/v14.0/dialog/oauth?client_id=${appId}&redirect_uri=${backendRedirectUrl}&response_type=${responseType}&scope=${scopes.join(',')}&state=${requestId}`);
        }
    };

    onTikTokSocialLogin = () => {
        const { requestId } = this.state;
        const clientKey = TIKTOK_CLIENT_KEY;
        const backendRedirectUrl = 'https://api.therr.com/v1/users-service/social-sync/oauth2-tiktok';
        const responseType = 'code';
        // const scopes = ['public_profile', 'instagram_basic', 'instagram_manage_insights', 'pages_show_list', 'pages_read_engagement'];
        const scopes = ['user.info.basic'];
        // eslint-disable-next-line max-len
        Linking.openURL(`https://www.tiktok.com/auth/authorize/?client_key=${clientKey}&scope=${scopes.join(',')}&response_type=${responseType}&redirect_uri=${backendRedirectUrl}&state=${requestId}`);
    };

    onOAuthLoginSuccess = (results) => {
        const { activeProvider } = this.state;
        this.onCloseOAuthModal();
        if (activeProvider === 'instagram') {
            return this.onSaveInstagram({
                instagram: {
                    accessToken: results.access_token,
                    userId: results.user_id,
                },
            });
        }

        if (activeProvider === 'facebook-instagram') {
            return this.onSaveFacebook({
                'facebook-instagram': {
                    accessToken: results.access_token,
                },
            });
        }

        if (activeProvider === 'tiktok') {
            return this.onSaveTikTok({
                'tiktok': {
                    accessToken: results.access_token,
                },
            });
        }
    };

    onOAuthLoginFailed = (results) => {
        this.onCloseOAuthModal();
        console.log('OAuthFailed: ', results);
        Toast.show({
            type: 'errorBig',
            text1: this.translate('forms.socialSync.errorTitles.oops'),
            text2: this.translate('forms.socialSync.errorAlerts.unknownError'),
        });
    };

    render() {
        const { navigation, route, user } = this.props;
        const {
            activeProvider,
            isAccountTypeModalVisible,
            isOAuthModalVisible,
            inputs,
            oAuthAppId,
            oAuthScopes,
            requestId,
        } = this.state;
        const pageHeaderSocials = this.translate('pages.socialSync.pageHeaderSyncList');
        const descriptionText = this.translate('pages.socialSync.description');
        const userInView = route?.params;
        const backendRedirectUrl = activeProvider === 'facebook-instagram'
            ? 'https://api.therr.com/v1/users-service/social-sync/oauth2-facebook'
            : `https://api.therr.com/v1/users-service/social-sync/oauth2-${activeProvider}`;
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
                                <View style={spacingStyles.padRtLg}>
                                    <SocialIconLink
                                        iconName="instagram"
                                        isMe={true}
                                        navigation={navigation}
                                        themeUser={this.themeUser}
                                        userInView={userInView}
                                    />
                                </View>
                                <Button
                                    containerStyle={[spacingStyles.flexOne]}
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
                                    onPress={() => this.onSocialLogin('instagram')}
                                />
                            </View>
                            <View style={this.themeSocialSyncForm.styles.socialLinkContainer}>
                                <View style={spacingStyles.padRtLg}>
                                    <SocialIconLink
                                        iconName="tiktok"
                                        isMe={true}
                                        navigation={navigation}
                                        themeUser={this.themeUser}
                                        userInView={userInView}
                                    />
                                </View>
                                <Button
                                    containerStyle={[spacingStyles.flexOne]}
                                    buttonStyle={[this.themeForms.styles.buttonRoundAlt]}
                                    titleStyle={this.themeForms.styles.buttonTitleAlt}
                                    title={this.translate('forms.socialSync.buttons.syncTikTok')}
                                    // icon={
                                    //     <FontAwesome5Icon
                                    //         name="sync"
                                    //         size={22}
                                    //         style={this.themeForms.styles.buttonIconAlt}
                                    //     />
                                    // }
                                    raised={false}
                                    onPress={() => this.onSocialLogin('tiktok')}
                                />
                            </View>
                            <View style={this.themeSocialSyncForm.styles.socialLinkContainer}>
                                <View style={spacingStyles.padRtLg}>
                                    <SocialIconLink
                                        iconName="twitter"
                                        isMe={true}
                                        navigation={navigation}
                                        themeUser={this.themeUser}
                                        userInView={userInView}
                                    />
                                </View>
                                <SquareInput
                                    containerStyle={spacingStyles.flexOne}
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
                            <View style={this.themeSocialSyncForm.styles.socialLinkContainer}>
                                <View style={spacingStyles.padRtLg}>
                                    <SocialIconLink
                                        iconName="youtube"
                                        isMe={true}
                                        navigation={navigation}
                                        themeUser={this.themeUser}
                                        userInView={userInView}
                                    />
                                </View>
                                <SquareInput
                                    containerStyle={spacingStyles.flexOne}
                                    labelStyle={this.themeForms.styles.inputLabelLightFaded}
                                    value={inputs.youtubeChannelId}
                                    onChangeText={(text) =>
                                        this.onInputChange('youtubeChannelId', text)
                                    }
                                    placeholder={this.translate(
                                        'forms.socialSync.placeholders.youtubeChannelId'
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
                                    onPress={this.onSaveYoutube}
                                />
                            </View>
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
                <View style={this.themeMenu.styles.submitButtonContainerFloat}>
                    <Button
                        buttonStyle={this.themeForms.styles.button}
                        titleStyle={this.themeForms.styles.buttonTitle}
                        title={this.translate(
                            'forms.socialSync.buttons.backToProfile'
                        )}
                        icon={
                            <TherrIcon
                                name="go-back"
                                size={22}
                                style={this.themeForms.styles.buttonIcon}
                            />
                        }
                        onPress={navigation.goBack}
                        raised={true}
                    />
                </View>
                <OAuthModal
                    appId={oAuthAppId}
                    onRequestClose={this.onCloseOAuthModal}
                    onLoginSuccess={this.onOAuthLoginSuccess}
                    onLoginFailure={this.onOAuthLoginFailed}
                    // Note: This must match the redirect url on the backend
                    backendRedirectUrl={backendRedirectUrl}
                    frontendRedirectUrl="https://therr.com"
                    responseType="code"
                    scopes={oAuthScopes}
                    isVisible={isOAuthModalVisible}
                    language="en"
                    provider={activeProvider}
                    incognito={false}
                    themeModal={this.themeOAuthModal}
                    requestId={requestId}
                />
                <WrapperModal
                    isVisible={isAccountTypeModalVisible}
                    onRequestClose={this.onCloseAccountTypeModal}
                    themeModal={this.themeModal}
                >
                    <View style={this.themeModal.styles.header}>
                        <Text style={this.themeModal.styles.headerText}>{this.translate('pages.socialSync.modals.accountTypeModalTitle')}</Text>
                    </View>
                    <View style={this.themeModal.styles.buttonsWrapper}>
                        <Text
                            style={this.themeModal.styles.label}
                        >{this.translate('pages.socialSync.labels.personalAccount')}</Text>
                        <Button
                            containerStyle={[this.themeForms.styles.buttonContainer, spacingStyles.fullWidth]}
                            buttonStyle={[this.themeForms.styles.button, { backgroundColor: this.themeForms.colors.instagram }]}
                            titleStyle={this.themeForms.styles.buttonTitle}
                            title={this.translate(
                                'pages.socialSync.buttons.personalAccount'
                            )}
                            icon={<FontAwesome5Icon
                                name="instagram"
                                size={22}
                                style={this.themeForms.styles.buttonIcon}
                            />}
                            onPress={() => this.onSelectMetaAccountType('personal')}
                            raised={true}
                        />
                        <Text
                            style={this.themeModal.styles.label}
                        >{this.translate('pages.socialSync.labels.businessAccount')}</Text>
                        <Button
                            containerStyle={[this.themeForms.styles.buttonContainer, spacingStyles.fullWidth]}
                            buttonStyle={[this.themeForms.styles.button, { backgroundColor: this.themeForms.colors.facebook }]}
                            titleStyle={this.themeForms.styles.buttonTitle}
                            title={this.translate(
                                'pages.socialSync.buttons.businessAccount'
                            )}
                            icon={<FontAwesome5Icon
                                name="facebook"
                                size={22}
                                style={this.themeForms.styles.buttonIcon}
                            />}
                            onPress={() => this.onSelectMetaAccountType('business')}
                            raised={true}
                        />
                    </View>
                </WrapperModal>
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
