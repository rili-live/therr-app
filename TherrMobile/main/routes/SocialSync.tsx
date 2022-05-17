import React from 'react';
import { SafeAreaView, View, Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Button }  from 'react-native-elements';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
// import { Picker as ReactPicker } from '@react-native-picker/picker';
import { IUserState } from 'therr-react/types';
// import { Content } from 'therr-js-utilities/constants';
import { UsersService } from 'therr-react/services';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
// import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
// import RNFB from 'rn-fetch-blob';
import MainButtonMenu from '../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../redux/actions/UsersActions';
// import Alert from '../components/Alert';
import translator from '../services/translator';
import { buildStyles } from '../styles';
import { buildStyles as buildMenuStyles } from '../styles/navigation/buttonMenu';
import { buildStyles as buildAlertStyles } from '../styles/alerts';
import { buildStyles as buildFormStyles } from '../styles/forms';
import { buildStyles as buildSettingsFormStyles } from '../styles/forms/socialSyncForm';
import SquareInput from '../components/Input/Square';
import BaseStatusBar from '../components/BaseStatusBar';
// import UserImage from '../components/UserContent/UserImage';
// import { getUserImageUri, signImageUrl } from '../utilities/content';


interface ISocialSyncDispatchProps {
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
    isSubmitting: boolean;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateUser: UsersActions.update,
}, dispatch);

export class SocialSync extends React.Component<ISocialSyncProps, ISocialSyncState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();
    private themeAlerts = buildAlertStyles();
    private themeForms = buildFormStyles();
    private themeSocialSyncForm = buildSettingsFormStyles();

    constructor(props) {
        super(props);

        this.state = {
            errorMsg: '',
            successMsg: '',
            inputs: {
                email: props.user.details.email,
                firstName: props.user.details.firstName,
                lastName: props.user.details.lastName,
                userName: props.user.details.userName,
                phoneNumber: props.user.details.phoneNumber,
                settingsBio: props.user.settings.settingsBio,
                shouldHideMatureContent: props.user.details.shouldHideMatureContent,
            },
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
        const { inputs, isSubmitting } = this.state;

        // TODO: Add message to show when passwords not equal
        return (
            (inputs.oldPassword && inputs.password !== inputs.repeatPassword) ||
            !inputs.userName ||
            !inputs.firstName ||
            !inputs.lastName ||
            !inputs.phoneNumber ||
            isSubmitting
        );
    }

    reloadTheme = () => {
        const themeName = this.props.user.settings?.mobileThemeName;

        this.theme = buildStyles(themeName);
        this.themeMenu = buildMenuStyles(themeName);
        this.themeAlerts = buildAlertStyles(themeName);
        this.themeForms = buildFormStyles(themeName);
        this.themeSocialSyncForm = buildSettingsFormStyles(themeName);
    }

    onSubmit = () => {
        const { inputs } = this.state;
        console.log('Submit', inputs);
        UsersService.createUpdateSocialSyncs({
            syncs: {
                twitter: {
                    username: inputs.twitterHandle,
                },
            },
        }).then((response) => console.log(response.data))
            .catch((err) => {
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

    render() {
        const { navigation, user } = this.props;
        const { inputs } = this.state;
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
