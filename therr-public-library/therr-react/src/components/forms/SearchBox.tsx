import * as React from 'react';
import * as PropTypes from 'prop-types';
import classnames from 'classnames';
// import 'therr-styles/icons.scss';
import Input from './Input';
import VALIDATIONS from '../../constants/VALIDATIONS';

class SearchBox extends React.Component<any, any> {
    static getDerivedStateFromProps(nextProps: any, nextState: any) {
        if (nextProps.value !== nextState.inputValue) {
            return {
                inputValue: nextProps.value,
            };
        }

        return {};
    }

    static propTypes: any = {
        autoComplete: PropTypes.oneOf(['off', 'on']),
        disabled: PropTypes.bool,
        id: PropTypes.string.isRequired,
        labelText: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        onChange: PropTypes.func.isRequired,
        onSearch: PropTypes.func.isRequired,
        translate: PropTypes.func.isRequired,
        value: PropTypes.string.isRequired,
        validations: PropTypes.arrayOf(PropTypes.oneOf(Object.keys(VALIDATIONS))),
    };

    static defaultProps: any = {
        autoComplete: 'on',
        disabled: false,
        isRequired: false,
        validations: [],
    };

    constructor(props: any) {
        super(props);

        this.state = {
            inputValue: props.value,
            isDirty: !!props.value,
            isActive: false,
        };
    }

    handleInputChange = (key: any, value: any) => {
        this.setState({
            isDirty: !!value.length,
        });
        this.props.onChange(key, value);
    };

    handleSearch = (event: any) => {
        this.props.onSearch(event, this.state.inputValue);
    };

    onBlur = () => {
        this.setState({
            isActive: false,
        });
    };

    onFocus = () => {
        this.setState({
            isActive: true,
        });
    };

    render() {
        const {
            autoComplete, disabled, id, labelText, name, translate, validations,
        } = this.props;
        const { inputValue, isActive, isDirty } = this.state;
        const additionalClasses = classnames({
            'is-dirty': isDirty,
            'is-active': isActive,
        });

        return (
            <div className={`search-box icon-medium search ${additionalClasses}`}>
                <label htmlFor={id}>{labelText}</label>
                <Input
                    autoComplete={autoComplete}
                    disabled={disabled}
                    id={id}
                    name={name}
                    onChange={this.handleInputChange}
                    onBlur={this.onBlur}
                    onEnter={this.handleSearch}
                    translate={translate}
                    type="search"
                    onFocus={this.onFocus}
                    validations={validations}
                    value={inputValue}
                />
            </div>
        );
    }
}

export default SearchBox;
