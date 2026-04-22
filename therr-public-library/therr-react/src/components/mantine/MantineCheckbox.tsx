import * as React from 'react';
import { Checkbox, CheckboxProps } from '@mantine/core';

interface IMantineCheckboxProps extends Omit<CheckboxProps, 'onChange' | 'checked'> {
    id?: string;
    name?: string;
    label: string;
    isChecked?: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const MantineCheckbox: React.FC<IMantineCheckboxProps> = ({
    id,
    name,
    label,
    isChecked,
    onChange,
    ...rest
}) => (
    <Checkbox
        id={id}
        name={name}
        label={label}
        checked={isChecked}
        onChange={onChange}
        {...rest}
    />
);

export default MantineCheckbox;
