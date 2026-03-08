import * as React from 'react';
import { Checkbox, CheckboxProps } from '@mantine/core';

interface IMantineCheckboxProps extends Omit<CheckboxProps, 'onChange'> {
    id?: string;
    name?: string;
    label: string;
    checked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const MantineCheckbox: React.FC<IMantineCheckboxProps> = ({
    id,
    name,
    label,
    checked,
    onChange,
    ...rest
}) => (
    <Checkbox
        id={id}
        name={name}
        label={label}
        checked={checked}
        onChange={onChange}
        {...rest}
    />
);

export default MantineCheckbox;
