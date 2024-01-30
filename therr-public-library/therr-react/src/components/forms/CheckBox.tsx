import * as React from 'react';

interface ICheckBox {
    id?: string;
    name?: string;
    string?: string;
    label: string;
    value: boolean;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
    className?: string;
    formClassName?: string;
    disabled?: boolean;
}

const CheckBox = ({
    id,
    name,
    label,
    value,
    onChange,
    className,
    formClassName,
    disabled,
}: ICheckBox) => (
    <div className={`form-field ${className || ''} ${formClassName || ''}`}>
        <label htmlFor={id}>
            <input
                id={id}
                name={name}
                type="checkbox"
                checked={value}
                onChange={onChange}
                disabled={disabled}
            />
            {label}
        </label>
    </div>
);

export default CheckBox;
