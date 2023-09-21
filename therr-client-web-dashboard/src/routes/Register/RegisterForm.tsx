import * as React from 'react';
import {
    Col, Row, Card, Form, Button, InputGroup, FormCheck,
} from 'react-bootstrap';
import {
    FontAwesomeIcon,
} from '@fortawesome/react-fontawesome';
import {
    faEnvelope,
    faUnlockAlt,
} from '@fortawesome/free-solid-svg-icons';
import * as yup from 'yup';
import { VALIDATIONS } from 'therr-react/constants';
import {
    PasswordRequirements,
} from 'therr-react/components';
import translator from '../../services/translator';

const schema = yup.object().shape({
    email: yup.string().email().required(),
    password: yup.string().matches(RegExp(VALIDATIONS.password.regex)).required(),
    repeatPassword: yup.string().matches(RegExp(VALIDATIONS.password.regex), 'Password must meet minimum complexity requirements').required(),
    website: yup.string().optional(),
    terms: yup.bool().required().oneOf([true], 'Terms must be accepted'),
});

// Regular component props
interface IRegisterFormProps {
    onValidate: (message: string) => any;
    register: Function;
}

interface IRegisterFormState {
    inputs: any;
    isSubmitting: boolean;
}

/**
 * RegisterForm
 * TODO: Use timer and mark as spam if form is submitted in less that 2 second
 */
export class RegisterFormComponent extends React.Component<IRegisterFormProps, IRegisterFormState> {
    private translate: Function;

    constructor(props: IRegisterFormProps) {
        super(props);

        this.state = {
            inputs: {
                email: '',
                password: '',
                repeatPassword: '',
                terms: false,
                website: '',
            },
            isSubmitting: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    isFormDisabled() {
        const {
            inputs,
            isSubmitting,
        } = this.state;
        return isSubmitting || !inputs.email || !inputs.password || !this.isFormValid();
    }

    isFormValid() {
        return this.state.inputs.password === this.state.inputs.repeatPassword;
    }

    onSubmit = async (event: any) => {
        event.preventDefault();
        const { onValidate } = this.props;
        this.setState({
            isSubmitting: true,
        });
        schema.validate(this.state.inputs)
            .then(() => {
                const creds = { ...this.state.inputs };
                delete creds.repeatPassword;
                this.props.register(creds);
            })
            .catch((error) => {
                onValidate(error?.message);
            })
            .finally(() => {
                this.setState({
                    isSubmitting: false,
                });
            });
    };

    onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();
        const { name, value } = event.currentTarget;

        const newInputChanges = {
            [name]: value,
        };

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        });
    };

    onCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { checked } = event.currentTarget;

        const newInputChanges = {
            terms: !this.state.inputs.terms,
        };

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        });
    };

    public render(): JSX.Element | null {
        const { inputs } = this.state;

        return (
            <Form className='mt-4'>
                <Form.Group className='mb-4' controlId="email">
                    <Form.Label>{this.translate('components.registerForm.labels.email')}</Form.Label>
                    <InputGroup>
                        <InputGroup.Text>
                            <FontAwesomeIcon icon={faEnvelope} />
                        </InputGroup.Text>
                        <Form.Control
                            value={inputs.email}
                            name="email"
                            onChange={this.onInputChange}
                            required
                            type="text"
                            placeholder={this.translate('components.registerForm.labels.email')}
                        />
                    </InputGroup>
                </Form.Group>
                <Form.Group>
                    <Form.Group className='mb-4' controlId="password">
                        <Form.Label>{this.translate('components.registerForm.labels.password')}</Form.Label>
                        <InputGroup>
                            <InputGroup.Text>
                                <FontAwesomeIcon icon={faUnlockAlt} />
                            </InputGroup.Text>
                            <Form.Control
                                value={inputs.password}
                                minLength={8}
                                name="password"
                                onChange={this.onInputChange}
                                required
                                type="password"
                                placeholder={this.translate('components.registerForm.labels.password')}
                            />
                        </InputGroup>
                    </Form.Group>
                    <PasswordRequirements
                        className="mb-4 px-2"
                        password={inputs.password}
                        translate={this.translate}
                    />
                    <Form.Group className='mb-4' controlId="repeatPassword">
                        <Form.Label>{this.translate('components.registerForm.labels.repeatPassword')}</Form.Label>
                        <InputGroup>
                            <InputGroup.Text>
                                <FontAwesomeIcon icon={faUnlockAlt} />
                            </InputGroup.Text>
                            <Form.Control
                                value={inputs.repeatPassword}
                                minLength={8}
                                name="repeatPassword"
                                onChange={this.onInputChange}
                                required
                                type="password"
                                placeholder={this.translate('components.registerForm.labels.repeatPassword')}
                            />
                        </InputGroup>
                    </Form.Group>
                    <Form.Group controlId="sweety_pie">
                        <InputGroup>
                            <Form.Control
                                value={inputs.website}
                                minLength={8}
                                name="website"
                                onChange={this.onInputChange}
                                required
                                type="hidden"
                                placeholder={this.translate('components.registerForm.labels.mySweet')}
                                tabIndex={-1}
                            />
                        </InputGroup>
                    </Form.Group>
                    <FormCheck id="terms" type="checkbox" className="d-flex mb-4">
                        <FormCheck.Input required className="me-2" onChange={this.onCheckboxChange} checked={inputs.terms}/>
                        <FormCheck.Label htmlFor="terms">
                            I agree to the <Card.Link href="https://www.therr.app/terms-and-conditions.html" target="_blank">terms & conditions</Card.Link>
                        </FormCheck.Label>
                    </FormCheck>
                </Form.Group>
                <Button
                    id="register_button"
                    variant='primary'
                    type='submit'
                    className='w-100'
                    onClick={this.onSubmit}
                    onSubmit={this.onSubmit}
                    disabled={this.isFormDisabled()}>
                    {this.translate('components.registerForm.buttons.register')}
                </Button>
            </Form>
        );
    }
}

export default RegisterFormComponent;
