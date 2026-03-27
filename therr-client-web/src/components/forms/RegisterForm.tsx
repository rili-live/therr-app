import * as React from 'react';
import { Link } from 'react-router-dom';
import { Stack } from '@mantine/core';
import isValidPassword from 'therr-js-utilities/is-valid-password';
import {
    PasswordRequirements,
} from 'therr-react/components';
import {
    MantineButton,
    MantineCheckbox,
    MantineInput,
} from 'therr-react/components/mantine';
import GoogleSignInButtonWeb from './GoogleSignInButtonWeb';
import withTranslation from '../../wrappers/withTranslation';

// Regular component props
interface IRegisterFormProps {
  register: Function;
  onGoogleRegister?: Function;
  title: string;
  inviteCode?: string;
  locale: string;
  translate: (key: string, params?: any) => string;
}

interface IRegisterFormState {
    inputs: any;
    ssoError: string;
    isGoogleSubmitting: boolean;
}

/**
 * RegisterForm
 */
export class RegisterFormComponent extends React.Component<
    IRegisterFormProps, IRegisterFormState
> {
    constructor(props: IRegisterFormProps) {
        super(props);

        this.state = {
            inputs: {
                email: '',
                password: '',
                repeatPassword: '',
                hasAgreedToTerms: false,
                settingsEmailMarketing: true,
                inviteCode: props.inviteCode || '',
            },
            ssoError: '',
            isGoogleSubmitting: false,
        };
    }

    isFormDisabled() {
        return !this.state.inputs.email
            || !this.state.inputs.password
            || !this.state.inputs.hasAgreedToTerms
            || !this.isFormValid();
    }

    isFormValid() {
        const { inputs } = this.state;
        return inputs.password === inputs.repeatPassword
            && isValidPassword(inputs.password);
    }

    onSubmit = () => {
        if (!this.isFormDisabled()) {
            const creds = { ...this.state.inputs };
            delete creds.repeatPassword;
            this.props.register(creds);
        }
    };

    onInputChange = (name: string, value: string) => {
        const newInputChanges = {
            [name]: value,
        };

        if (name === 'userName') {
            newInputChanges[name] = value.toLowerCase();
        }

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        });
    };

    onCheckboxChange: React.ChangeEventHandler<HTMLInputElement> = (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const { name } = event.currentTarget;

        const newInputChanges = {
            [name]: !this.state.inputs[name],
        };

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        });
    };

    public render(): JSX.Element | null {
        const { inviteCode, locale } = this.props;
        const localePrefixMap: Record<string, string> = { es: '/es', 'fr-ca': '/fr' };
        const localePath = localePrefixMap[locale] || '';

        return (
            <div className="register-container">
                <div className="flex fill max-wide-30">
                    <Stack gap="sm">
                        <h1 className="text-center">{this.props.title}</h1>
                        {
                            inviteCode
                            && (
                                <h4 className="mb-1 text-underline text-center">
                                    {this.props.translate(
                                        'components.registerForm.text.signupForRewards',
                                        { userName: inviteCode },
                                    )}
                                </h4>
                            )
                        }
                        <MantineInput
                            type="text"
                            id="e_mail"
                            name="email"
                            value={this.state.inputs.email}
                            onChange={this.onInputChange}
                            onEnter={this.onSubmit}
                            translateFn={this.props.translate}
                            validations={['isRequired', 'email']}
                            label={this.props.translate(
                                'components.registerForm.labels.email',
                            )}
                        />

                        <MantineInput
                            type="password"
                            id="password"
                            name="password"
                            value={this.state.inputs.password}
                            onChange={this.onInputChange}
                            onEnter={this.onSubmit}
                            translateFn={this.props.translate}
                            validations={['isRequired', 'password']}
                            label={this.props.translate(
                                'components.registerForm.labels.password',
                            )}
                        />

                        {/* Honeypot field */}
                        <input
                            autoComplete="off"
                            type="text"
                            id="sweety_pie"
                            name="website"
                            value={this.state.inputs.website || ''}
                            onChange={(e) => this.onInputChange('website', e.target.value)}
                            tabIndex={-1}
                            style={{ position: 'absolute', left: '-9999px' }}
                            aria-hidden="true"
                        />

                        <MantineInput
                            type="password"
                            id="repeat_password"
                            name="repeatPassword"
                            value={this.state.inputs.repeatPassword}
                            onChange={this.onInputChange}
                            onEnter={this.onSubmit}
                            translateFn={this.props.translate}
                            validations={['isRequired']}
                            label={this.props.translate(
                                'components.registerForm.labels.repeatPassword',
                            )}
                        />

                        <PasswordRequirements
                            className="password-requirements mb-2 px-2"
                            password={this.state.inputs.password}
                            translate={this.props.translate}
                        />

                        <MantineInput
                            type="text"
                            id="invite_code"
                            name="inviteCode"
                            value={this.state.inputs.inviteCode}
                            onChange={this.onInputChange}
                            onEnter={this.onSubmit}
                            translateFn={this.props.translate}
                            validations={[]}
                            label={this.props.translate(
                                'components.registerForm.labels.inviteCode',
                            )}
                        />
                        <p className="text-center" style={{ fontSize: '0.75rem', margin: '0 0 0.5rem' }}>
                            {this.props.translate('components.registerForm.text.inviteCodeHint')}
                        </p>

                        <MantineCheckbox
                            id="newsletter"
                            name="settingsEmailMarketing"
                            label={this.props.translate(
                                'components.registerForm.labels.newsletter',
                            )}
                            isChecked={this.state.inputs.settingsEmailMarketing}
                            onChange={this.onCheckboxChange}
                        />

                        <MantineCheckbox
                            id="terms_and_conditions"
                            name="hasAgreedToTerms"
                            label={this.props.translate(
                                'components.registerForm.labels.termsAndConditions',
                            )}
                            isChecked={this.state.inputs.hasAgreedToTerms}
                            onChange={this.onCheckboxChange}
                        />

                        <div className="form-field text-right">
                            <MantineButton
                                id="register"
                                text={this.props.translate(
                                    'components.registerForm.buttons.register',
                                )}
                                onClick={this.onSubmit}
                                disabled={this.isFormDisabled()}
                                fullWidth
                            />
                        </div>

                        {this.props.onGoogleRegister && (
                            <>
                                <div className="sso-divider" style={{ textAlign: 'center', margin: '0.75rem 0' }}>
                                    {this.props.translate('components.registerForm.sso.orDivider')}
                                </div>
                                <GoogleSignInButtonWeb
                                    isLoading={this.state.isGoogleSubmitting}
                                    onSuccess={(ssoData) => {
                                        this.setState({ isGoogleSubmitting: true, ssoError: '' });
                                        this.props.onGoogleRegister(ssoData)
                                            .catch(() => {
                                                this.setState({ isGoogleSubmitting: false });
                                            });
                                    }}
                                    onError={(msg) => this.setState({ ssoError: msg, isGoogleSubmitting: false })}
                                    buttonText="signup_with"
                                    translate={this.props.translate}
                                />
                                {this.state.ssoError && (
                                    <div className="alert-error text-center">{this.state.ssoError}</div>
                                )}
                            </>
                        )}

                        <div className="text-left">
                            <Link to="/login">
                                {this.props.translate(
                                    'components.registerForm.buttons.backToLogin',
                                )}
                            </Link>
                        </div>

                        <div className="text-center margin-top-lg">
                            <a
                                href={`https://www.therr.app${localePath}/terms-and-conditions.html`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {this.props.translate(
                                    'components.registerForm.buttons.terms',
                                )}
                            </a>
                        </div>
                    </Stack>
                </div>
            </div>
        );
    }
}

export default withTranslation(RegisterFormComponent);
