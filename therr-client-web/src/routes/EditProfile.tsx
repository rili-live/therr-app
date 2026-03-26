import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import {
    Alert, Card, Container, Stack, Switch, Textarea,
} from '@mantine/core';
import {
    MantineButton,
    MantineInput,
    MantineSelect,
} from 'therr-react/components/mantine';
import { IUserState } from 'therr-react/types';
import { sanitizeUserName } from 'therr-js-utilities/sanitizers';
import UsersActions from '../redux/actions/UsersActions';
import getUserImageUri from '../utilities/getUserImageUri';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';

const MAX_BIO_LENGTH = 255;

interface IEditProfileRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
}

interface IEditProfileDispatchProps {
    updateUser: Function;
}

interface IStoreProps extends IEditProfileDispatchProps {
    user: IUserState;
}

interface IEditProfileProps extends IEditProfileRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
}

interface IEditProfileState {
    inputs: {
        firstName?: string;
        lastName?: string;
        userName?: string;
        settingsBio?: string;
        settingsIsProfilePublic?: boolean;
        shouldHideMatureContent?: boolean;
        settingsLocale?: string;
        settingsThemeName?: string;
    };
    errorReason: string;
    isSuccess: boolean;
    isSubmitting: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateUser: UsersActions.update,
}, dispatch);

/**
 * EditProfile
 */
export class EditProfileComponent extends React.Component<IEditProfileProps, IEditProfileState> {
    constructor(props: IEditProfileProps) {
        super(props);

        const { user } = props;

        this.state = {
            inputs: {
                firstName: user.details?.firstName || '',
                lastName: user.details?.lastName || '',
                userName: user.details?.userName || '',
                settingsBio: user.settings?.settingsBio || '',
                settingsIsProfilePublic: user.settings?.settingsIsProfilePublic ?? true,
                shouldHideMatureContent: user.details?.shouldHideMatureContent ?? false,
                settingsLocale: user.settings?.locale || 'en-us',
                settingsThemeName: user.settings?.mobileThemeName || 'light',
            },
            errorReason: '',
            isSuccess: false,
            isSubmitting: false,
        };
    }

    componentDidMount() {
        document.title = `Therr | ${this.props.translate('pages.editProfile.pageTitle')}`;
    }

    isFormDisabled = () => {
        const { user } = this.props;
        const { inputs, isSubmitting } = this.state;
        if (isSubmitting || !inputs.firstName || !inputs.userName) {
            return true;
        }
        if (!user.details?.isBusinessAccount && !inputs.lastName) {
            return true;
        }
        return false;
    };

    onInputChange = (name: string, value: string) => {
        let sanitizedValue = value;
        if (name === 'userName') {
            sanitizedValue = sanitizeUserName(value);
        }

        this.setState({
            inputs: {
                ...this.state.inputs,
                [name]: sanitizedValue,
            },
            errorReason: '',
            isSuccess: false,
        });
    };

    onBioChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = event.target.value;
        if (value.length <= MAX_BIO_LENGTH) {
            this.setState({
                inputs: {
                    ...this.state.inputs,
                    settingsBio: value,
                },
                errorReason: '',
                isSuccess: false,
            });
        }
    };

    onSwitchChange = (name: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                [name]: event.currentTarget.checked,
            },
            errorReason: '',
            isSuccess: false,
        });
    };

    onSelectChange = (name: string) => (value: string | null) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                [name]: value || '',
            },
            errorReason: '',
            isSuccess: false,
        });
    };

    onSubmit = (event: any) => {
        event.preventDefault();

        if (this.isFormDisabled()) return;

        const { user, updateUser } = this.props;
        const { inputs } = this.state;

        this.setState({ isSubmitting: true, errorReason: '', isSuccess: false });

        const updateArgs: any = {
            firstName: inputs.firstName,
            lastName: inputs.lastName || '',
            userName: inputs.userName,
            settingsBio: inputs.settingsBio,
            settingsIsProfilePublic: inputs.settingsIsProfilePublic,
            shouldHideMatureContent: inputs.shouldHideMatureContent,
            settingsLocale: inputs.settingsLocale,
            settingsThemeName: inputs.settingsThemeName,
        };

        updateUser(user.details.id, updateArgs)
            .then(() => {
                this.setState({
                    isSuccess: true,
                    errorReason: '',
                });
            })
            .catch((error: any) => {
                if (error.statusCode === 400) {
                    this.setState({
                        errorReason: error.message || 'BadRequest',
                    });
                } else {
                    this.setState({
                        errorReason: 'ServerError',
                    });
                }
            })
            .finally(() => {
                this.setState({ isSubmitting: false });
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
    };

    navigateToChangePassword = () => {
        this.props.navigation.navigate('/users/change-password');
    };

    navigateToViewProfile = () => {
        this.props.navigation.navigate('/user/profile');
    };

    public render(): JSX.Element | null {
        const { user } = this.props;
        const {
            errorReason, inputs, isSuccess, isSubmitting,
        } = this.state;

        if (!user.details) {
            return null;
        }

        const bioCharCount = inputs.settingsBio?.length || 0;
        const isBusiness = user.details.isBusinessAccount;

        return (
            <div id="page_edit_profile">
                <Container size="sm">
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Stack gap="md">
                            <div className="edit-profile-header">
                                <div className="edit-profile-avatar">
                                    <img
                                        src={getUserImageUri(user, 100)}
                                        alt="Profile"
                                        width="80"
                                        height="80"
                                    />
                                </div>
                                <h1>{this.props.translate('pages.editProfile.pageTitle')}</h1>
                            </div>

                            {!errorReason && isSuccess && (
                                <Alert color="green" variant="light">
                                    {this.props.translate('pages.editProfile.successMessage')}
                                </Alert>
                            )}
                            {errorReason === 'BadRequest' && (
                                <Alert color="red" variant="light">
                                    {this.props.translate('pages.editProfile.failedMessageBadRequest')}
                                </Alert>
                            )}
                            {errorReason === 'ServerError' && (
                                <Alert color="red" variant="light">
                                    {this.props.translate('pages.editProfile.failedMessageServer')}
                                </Alert>
                            )}
                            {errorReason && errorReason !== 'BadRequest' && errorReason !== 'ServerError' && (
                                <Alert color="red" variant="light">
                                    {errorReason}
                                </Alert>
                            )}

                            <h2 className="edit-profile-section-title">
                                {this.props.translate('pages.editProfile.h2.profileInfo')}
                            </h2>

                            <MantineInput
                                id="first_name"
                                name="firstName"
                                value={inputs.firstName}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={this.props.translate}
                                validations={['isRequired']}
                                label={isBusiness
                                    ? this.props.translate('pages.editProfile.labels.businessName')
                                    : this.props.translate('pages.editProfile.labels.firstName')}
                            />
                            <MantineInput
                                id="last_name"
                                name="lastName"
                                value={inputs.lastName}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={this.props.translate}
                                validations={isBusiness ? [] : ['isRequired']}
                                label={isBusiness
                                    ? this.props.translate('pages.editProfile.labels.businessSuffix')
                                    : this.props.translate('pages.editProfile.labels.lastName')}
                            />
                            <MantineInput
                                id="user_name"
                                name="userName"
                                value={inputs.userName}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={this.props.translate}
                                validations={['isRequired']}
                                label={this.props.translate('pages.editProfile.labels.userName')}
                            />
                            <MantineInput
                                id="email"
                                name="email"
                                value={user.details.email}
                                onChange={() => { /* read-only */ }}
                                translateFn={this.props.translate}
                                label={this.props.translate('pages.editProfile.labels.email')}
                                disabled
                            />
                            <div className="bio-field">
                                <Textarea
                                    id="settings_bio"
                                    label={this.props.translate('pages.editProfile.labels.bio')}
                                    value={inputs.settingsBio}
                                    onChange={this.onBioChange}
                                    maxLength={MAX_BIO_LENGTH}
                                    autosize
                                    minRows={3}
                                    maxRows={5}
                                />
                                <span className="bio-char-count">
                                    {bioCharCount}/{MAX_BIO_LENGTH}
                                </span>
                            </div>

                            <h2 className="edit-profile-section-title">
                                {this.props.translate('pages.editProfile.h2.privacy')}
                            </h2>

                            <Switch
                                label={this.props.translate('pages.editProfile.labels.profilePublic')}
                                checked={inputs.settingsIsProfilePublic}
                                onChange={this.onSwitchChange('settingsIsProfilePublic')}
                            />

                            <Switch
                                label={this.props.translate('pages.editProfile.labels.hideMatureContent')}
                                checked={inputs.shouldHideMatureContent}
                                onChange={this.onSwitchChange('shouldHideMatureContent')}
                            />

                            <h2 className="edit-profile-section-title">
                                {this.props.translate('pages.editProfile.h2.display')}
                            </h2>

                            <MantineSelect
                                id="settings_theme"
                                label={this.props.translate('pages.editProfile.labels.theme')}
                                value={inputs.settingsThemeName || 'light'}
                                onChange={this.onSelectChange('settingsThemeName')}
                                data={[
                                    { value: 'light', label: this.props.translate('pages.editProfile.themeOptions.light') },
                                    { value: 'dark', label: this.props.translate('pages.editProfile.themeOptions.dark') },
                                    { value: 'retro', label: this.props.translate('pages.editProfile.themeOptions.retro') },
                                ]}
                            />

                            <MantineSelect
                                id="settings_locale"
                                label={this.props.translate('pages.editProfile.labels.language')}
                                value={inputs.settingsLocale || 'en-us'}
                                onChange={this.onSelectChange('settingsLocale')}
                                data={[
                                    { value: 'en-us', label: 'English' },
                                    { value: 'es', label: 'Espa\u00f1ol' },
                                ]}
                            />

                            <h2 className="edit-profile-section-title">
                                {this.props.translate('pages.editProfile.h2.account')}
                            </h2>

                            <MantineButton
                                id="change_password_link"
                                text={this.props.translate('pages.editProfile.buttons.changePassword')}
                                onClick={this.navigateToChangePassword}
                                variant="outline"
                                fullWidth
                            />

                            <div className="edit-profile-actions">
                                <MantineButton
                                    id="view_profile_link"
                                    text={this.props.translate('pages.editProfile.buttons.viewProfile')}
                                    onClick={this.navigateToViewProfile}
                                    variant="subtle"
                                />
                                <MantineButton
                                    id="save_profile"
                                    text={this.props.translate('pages.editProfile.buttons.save')}
                                    onClick={this.onSubmit}
                                    disabled={this.isFormDisabled()}
                                    loading={isSubmitting}
                                />
                            </div>
                        </Stack>
                    </Card>
                </Container>
            </div>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(EditProfileComponent)));
