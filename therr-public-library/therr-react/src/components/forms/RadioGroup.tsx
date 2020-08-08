import * as React from 'react';
import * as PropTypes from 'prop-types';

class RadioGroup extends React.Component<any, any> {
    static propTypes = {
        name: PropTypes.string.isRequired,
        onSelect: PropTypes.func.isRequired,
        options: PropTypes.arrayOf(PropTypes.shape({
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]).isRequired,
            text: PropTypes.string.isRequired,
        })).isRequired,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]).isRequired,
    };

    selectOption = (event: any) => {
        event.preventDefault();
        const key = this.props.name;
        const value = event.target.dataset.value;

        this.props.onSelect(key, value);
    }

    render() {
        const { options, value } = this.props;

        return (
            <div className="radio-group form-field">
                {
                    options.map((option: any) => (<div key={option.value} className="radio-option">
                        <button
                            className="psuedo-label"
                            data-value={option.value}
                            onClick={this.selectOption}
                            type="button"
                        >
                            {option.text}
                        </button>
                        <label
                            className={option.value === value ? 'selected' : ''}
                            data-value={option.value}
                            htmlFor={option.value}
                            onClick={this.selectOption}
                        />
                    </div>))
                }
            </div>
        );
    }
}

export default RadioGroup;
