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
import SquareInput from '../../components/Input/Square';
import BaseStatusBar from '../../components/BaseStatusBar';
import OAuthModal from '../../components/Modals/OAuthModal';
// import UserImage from '../components/UserContent/UserImage';
// import { getUserImageUri, signImageUrl } from '../utilities/content';


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
    }

    onSubmit = () => {
        const { createUpdateSocialSyncs, navigation } = this.props;
        const { inputs } = this.state;
        createUpdateSocialSyncs({
            syncs: {
                twitter: {
                    username: inputs.twitterHandle,
                },
            },
        }).then(() => {
            navigation.goBack();
        }).catch((err) => {
            console.log(err);
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

    onOAuthLoginSuccess = (response, results) => {
        this.onCloseOAuthModal();
        console.log('OAuthSuccess: ', response, results);
    }

    onOAuthLoginFailed = (response) => {
        this.onCloseOAuthModal();
        console.log('OAuthFailed: ', response);
    }


    render() {
        const { navigation, user } = this.props;
        const { inputs, isOAuthModalVisible } = this.state;
        const pageHeaderSocials = this.translate('pages.socialSync.pageHeaderSyncList');
        const descriptionText = this.translate('pages.socialSync.description');
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
                                <SquareInput
                                    label={this.translate(
                                        'forms.socialSync.labels.twitterHandle'
                                    )}
                                    labelStyle={this.themeForms.styles.inputLabelLightFaded}
                                    value={inputs.twitterHandle}
                                    onChangeText={(text) =>
                                        this.onInputChange('twitterHandle', text)
                                    }
                                    placeholder={this.translate(
                                        'forms.socialSync.placeholders.twitterHandle'
                                    )}
                                    rightIcon={
                                        <FontAwesome5Icon
                                            name="twitter"
                                            size={22}
                                            color={this.theme.colors.twitter}
                                        />
                                    }
                                    themeForms={this.themeForms}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>
                            <View style={this.themeSocialSyncForm.styles.socialLinkContainer}>
                                <Button
                                    containerStyle={this.themeButtons.styles.btnContainer}
                                    buttonStyle={[this.themeButtons.styles.btnLargeWithText]}
                                    titleStyle={this.themeButtons.styles.btnLargeTitle}
                                    icon={
                                        <FontAwesome5Icon
                                            name="plus"
                                            size={22}
                                            style={this.themeButtons.styles.btnIcon}
                                        />
                                    }
                                    raised={true}
                                    onPress={this.onSocialLogin}
                                />
                            </View>
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
                <View style={this.themeSocialSyncForm.styles.submitButtonContainerFloat}>
                    <Button
                        buttonStyle={this.themeForms.styles.button}
                        title={this.translate(
                            'forms.settings.buttons.submit'
                        )}
                        onPress={this.onSubmit}
                        disabled={this.isFormDisabled()}
                        raised={true}
                    />
                </View>
                <OAuthModal
                    appId="8038208602859743"
                    onRequestClose={this.onCloseOAuthModal}
                    onLoginSuccess={this.onOAuthLoginSuccess}
                    onLoginFailure={this.onOAuthLoginFailed}
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
