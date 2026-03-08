import * as React from 'react';
import { Button, ButtonProps } from '@mantine/core';

interface IMantineButtonProps extends ButtonProps {
    id?: string;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    type?: 'button' | 'submit' | 'reset';
    children: React.ReactNode;
}

const MantineButton: React.FC<IMantineButtonProps> = ({
    id,
    onClick,
    type = 'button',
    variant = 'filled',
    children,
    ...rest
}) => (
    <Button
        id={id}
        onClick={onClick}
        type={type}
        variant={variant}
        {...rest}
    >
        {children}
    </Button>
);

export default MantineButton;
