import * as React from 'react';
import * as PropTypes from 'prop-types';
import { Key as KeyCode } from 'ts-keycode-enum';
import classnames from 'classnames';

const SELECTION_KEYS: any = [KeyCode.Enter, KeyCode.Space];

class SelectBox extends React.Component<any, any> {
    static getDerivedStateFromProps(nextProps: any, nextState: any) {
        if (nextProps.value !== nextState.value || nextProps.required !== nextState.required) {
            const modifiedValidationsState = SelectBox.updateValidations(nextProps);
            return {
                value: nextProps.value,
                required: nextProps.required,
                ...modifiedValidationsState,
            };
        }

        return {};
    }

    static updateValidations = (props: any) => {
        const { onValidate, translate } = props;

        if (onValidate) {
            onValidate({
                [props.id]: translate('validations.isRequired'),
            });
        }

        return {
            isInvalid: props.required && (!props.value && props.value !== false),
        };
    }

    static propTypes: any = {
        className: PropTypes.string,
        disabled: PropTypes.bool,
        id: PropTypes.string.isRequired,
        isTesting: PropTypes.bool,
        onChange: PropTypes.func.isRequired,
        onValidate: PropTypes.func,
        options: PropTypes.arrayOf(PropTypes.shape({
            text: PropTypes.string.isRequired,
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
        })).isRequired,
        placeHolderText: PropTypes.string,
        required: PropTypes.bool,
        translate: PropTypes.func.isRequired,
        value: PropTypes.string.isRequired,
    };

    static defaultProps: any = {
        className: 'block',
        disabled: false,
        isTesting: false,
        onValidate: null,
        placeHolderText: 'Select...',
        required: false,
    };


    constructor(props: any) {
        super(props);

        this.state = {
            axIndex: 0,
            optionsAreVisible: false,
            isInvalid: true,
            isTouched: false,
            value: props.value,
            required: props.required,
        };

        document.addEventListener('click', this.handlePageClick);
    }

    componentDidMount() {
        const modifiedValidationsState = SelectBox.updateValidations(this.props);
        this.setState(modifiedValidationsState);
    }

    componentWillUnmount() {
        document.removeEventListener('click', this.handlePageClick);
    }

    private buttonElement: any;

    handleArrowKey = (change: any) => {
        const { options } = this.props;
        const prevAxIndex = this.state.axIndex;
        let axIndex = 0;
        if (prevAxIndex + change > options.length - 1) {
            axIndex = 0;
        } else if (prevAxIndex + change < 0) {
            axIndex = options.length - 1;
        } else {
            axIndex = prevAxIndex + change;
        }
        this.setState({
            axIndex,
        });
    }

    handleKeyDown = (event: any) => {
        if (!this.props.disabled) {
            const pressedKey = event.keyCode;
            if (pressedKey === KeyCode.Tab) {
                if (this.state.optionsAreVisible) {
                    this.toggleSelectionVisibility();
                }
                return;
            }
            event.preventDefault();
            if (this.state.optionsAreVisible) {
                if (pressedKey === KeyCode.UpArrow) {
                    this.handleArrowKey(-1);
                } else if (pressedKey === KeyCode.DownArrow) {
                    this.handleArrowKey(1);
                } else if (pressedKey === KeyCode.Escape) {
                    this.toggleSelectionVisibility();
                } else if (SELECTION_KEYS.includes(pressedKey)) {
                    this.props.onChange(this.props.options[this.state.axIndex].value);
                    this.setState({
                        axIndex: this.state.axIndex,
                        optionsAreVisible: false,
                    });
                }
            } else if (SELECTION_KEYS.includes(pressedKey)) {
                this.toggleSelectionVisibility();
            }
        }
    }

    handlePageClick = (event: any) => {
        if (event.target !== this.buttonElement) {
            this.setState({
                optionsAreVisible: false,
            });
        }
    }

    handleSelectionChange = (event: any) => {
        event.preventDefault();
        if (!this.props.disabled) {
            const selection = this.props.options[event.target.dataset.index];
            this.props.onChange(selection.value);
        }
    }

    onFocus = () => {
        this.setState({
            isTouched: true,
        });
    }

    toggleSelectionVisibility = () => {
        const { disabled, options, value } = this.props;

        if (!disabled) {
            let axIndex = options.findIndex((option: any) => option.value === value);
            axIndex = axIndex === -1 ? 0 : axIndex;

            this.setState({
                axIndex,
                optionsAreVisible: !this.state.optionsAreVisible,
            });
        }
    }

    updateValidations = (props: any) => {
        const { onValidate, translate } = props;

        this.setState({
            isInvalid: props.required && (!props.value && props.value !== false),
        });
        if (onValidate) {
            onValidate({
                [props.id]: translate('validations.isRequired'),
            });
        }
    }

    render() {
        const {
            className, disabled, id, isTesting, options, placeHolderText, required, translate, value,
        } = this.props;
        const {
            axIndex, isInvalid, isTouched, optionsAreVisible,
        } = this.state;
        const selectedOption = options.find((option: any) => option.value === value) || [];
        const selectedText = translate(selectedOption.text);
        const mainClasses = classnames({
            disabled,
            active: optionsAreVisible,
            'is-invalid': isInvalid,
            'is-valid': !isInvalid && required,
            'is-touched': isTouched,
            'select-box': true,
        });

        const buttonClasses = classnames({
            'arrow-down': true,
            'icon-xsmall': true,
        });

        return (
            <div className="form-field">
                <div className={`${mainClasses} ${className}`}>
                    <button
                        className={buttonClasses}
                        id={id}
                        ref={(el) => { this.buttonElement = el; }}
                        onClick={this.toggleSelectionVisibility}
                        onFocus={this.onFocus}
                        onKeyDown={this.handleKeyDown}
                        disabled={disabled}
                    >
                        {selectedText || placeHolderText}
                    </button>
                    {
                        (optionsAreVisible || isTesting)
                        && <ul role="listbox" className="options-list">
                            {
                                options.map((option: any, index: any) => {
                                    const isSelected = option.value === value;
                                    const classList = classnames({
                                        'ax-active': index == axIndex, // eslint-disable-line eqeqeq
                                        'option-container': true,
                                        selected: isSelected,
                                    });

                                    return (
                                        <li
                                            key={option.value}
                                            className={classList}
                                            role="presentation"
                                        >
                                            <a
                                                onClick={this.handleSelectionChange}
                                                role="option"
                                                className="option-link"
                                                aria-checked={isSelected}
                                                aria-selected={isSelected}
                                                data-index={index}
                                                data-text={option.text}
                                            >
                                                {translate(option.text)}
                                            </a>
                                        </li>
                                    );
                                })
                            }
                        </ul>
                    }
                </div>
            </div>
        );
    }
}

export default SelectBox;
