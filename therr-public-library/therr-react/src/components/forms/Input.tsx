import * as React from 'react';
import * as PropTypes from 'prop-types';
import classnames from 'classnames';
import { Key as KeyCode } from 'ts-keycode-enum';
import isValidInput from 'therr-js-utilities/is-valid-input';
import VALIDATIONS from '../../constants/VALIDATIONS';

class Input extends React.Component<any, any> {
    static getDerivedStateFromProps(nextProps: any, nextState: any) {
        if (nextState.inputValue !== nextProps.value) {
            const modifiedValidationsState = Input.updateValidations(nextProps);
            return {
                inputValue: nextProps.value,
                ...modifiedValidationsState,
            };
        }

        const validationChanged = nextProps.validations.some((validation: any) => {
            if (!(nextState.validations || []).includes(validation)) {
                return true;
            }
            return false;
        });

        if (validationChanged) {
            const modifiedValidationsState = Input.updateValidations(nextProps);
            return {
                ...modifiedValidationsState,
            };
        }

        return {};
    }

    static updateValidations = (props: any) => {
        const { onValidate, translate } = props;
        const validationErrors: any = [];

        if (props.validations.length === 0) {
            return {};
        }

        props.validations.forEach((key: any) => {
            if (!isValidInput(VALIDATIONS, key, props.value)) {
                validationErrors.push({
                    key,
                    message: translate(VALIDATIONS[key].errorMessageLocalizationKey, {
                        value: props.value,
                    }),
                });
            }
        });

        if (onValidate) {
            onValidate({
                [props.id]: validationErrors,
            });
        }

        return {
            validations: props.validations,
            validationErrors,
        };
    }

    static propTypes: any = {
        autoComplete: PropTypes.oneOf(['off', 'on']),
        className: PropTypes.string,
        formClassName: PropTypes.string,
        disabled: PropTypes.bool,
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        onChange: PropTypes.func.isRequired,
        onBlur: PropTypes.func,
        onFocus: PropTypes.func,
        onEnter: PropTypes.func,
        onValidate: PropTypes.func,
        placeholder: PropTypes.string,
        translate: PropTypes.func.isRequired,
        type: PropTypes.oneOf(['number', 'password', 'search', 'text', 'url']),
        validations: PropTypes.arrayOf(PropTypes.oneOf(Object.keys(VALIDATIONS))),
        value: PropTypes.string,
    };

    static defaultProps: any = {
        autoComplete: 'on',
        className: 'appearance-none block w-full bg-grey-lighter text-grey-darker border border-grey-lighter py-3 px-4',
        disabled: false,
        formClassName: '',
        isRequired: false,
        onBlur: null,
        onFocus: null,
        onEnter: null,
        onValidate: null,
        placeholder: '',
        type: 'text',
        validations: [],
        value: '',
    };

    public inputEl: any;

    constructor(props: any) {
        super(props);

        this.state = {
            isDirty: false,
            isTouched: false,
            inputValue: props.input,
            validationErrors: [],
            prevPropsValidations: [],
        };
    }

    componentDidMount() {
        const modifiedValidationsState = Input.updateValidations(this.props);
        this.setState(modifiedValidationsState);
    }

    handleInputChange = (event: any) => {
        const name = event.target.name;
        const value = event.target.value;

        this.setState({
            isDirty: value && value !== false,
        });

        this.props.onChange(name, value);
    }

    handleKeyDown = (event: any) => {
        if (this.props.onEnter && event.keyCode === KeyCode.Enter) {
            this.props.onEnter(event);
        }
    }

    onFocus = () => {
        this.setState({
            isTouched: true,
        });

        return this.props.onFocus && this.props.onFocus();
    }

    onBlur = () => { // eslint-disable-line arrow-body-style
        const modifiedValidationsState = Input.updateValidations(this.props);
        this.setState(modifiedValidationsState);

        return this.props.onBlur && this.props.onBlur();
    }

    render() {
        const {
            autoComplete, className, disabled, formClassName, id, name, placeholder, type, validations,
        } = this.props;
        const {
            inputValue, isDirty, isTouched, validationErrors,
        } = this.state;
        const additionalClasses = classnames({
            'is-dirty': isDirty,
            'is-invalid': validationErrors.length > 0,
            'is-touched': isTouched,
            'is-valid': validationErrors.length === 0 && validations.length > 0,
        });

        return (
            <div className={`form-field ${formClassName}`}>
                <input
                    ref={(el) => { this.inputEl = el; }}
                    autoComplete={autoComplete}
                    className={`${className} ${additionalClasses}`}
                    disabled={disabled}
                    id={id}
                    name={name}
                    type={type}
                    value={inputValue}
                    onChange={this.handleInputChange}
                    onBlur={this.onBlur}
                    onFocus={this.onFocus}
                    onKeyDown={this.handleKeyDown}
                    placeholder={placeholder}
                />
                {
                    validationErrors.length > 0 && (isTouched || isDirty)
                    && <div className="validation-errors">
                        {
                            validationErrors.map((error: any) => (
                                <div key={error.key} className="message-container icon-small attention-alert">
                                    <em className="message">
                                        {error.message}
                                    </em>
                                </div>
                            ))
                        }
                    </div>
                }
            </div>
        );
    }
}

export default Input;
