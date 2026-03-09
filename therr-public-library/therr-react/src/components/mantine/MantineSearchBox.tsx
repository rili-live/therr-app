import * as React from 'react';
import { TextInput, TextInputProps } from '@mantine/core';

interface IMantineSearchBoxProps extends Omit<TextInputProps, 'onChange'> {
    id: string;
    name: string;
    value: string;
    onChange: (name: string, value: string) => void;
    onSearch: (value: string) => void;
}

const searchIcon = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const MantineSearchBox: React.FC<IMantineSearchBoxProps> = ({
    id,
    name,
    value,
    onChange,
    onSearch,
    ...rest
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(name, e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onSearch(value);
        }
    };

    return (
        <TextInput
            id={id}
            name={name}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            leftSection={searchIcon}
            {...rest}
        />
    );
};

export default MantineSearchBox;
