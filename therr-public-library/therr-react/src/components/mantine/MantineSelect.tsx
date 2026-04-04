import * as React from 'react';
import { Select, SelectProps } from '@mantine/core';

interface IMantineSelectProps extends Omit<SelectProps, 'onChange'> {
    id: string;
    name?: string;
    value: string | null;
    onChange: (value: string | null) => void;
    required?: boolean;
    translateFn?: (key: string, params?: Record<string, string>) => string;
    onValidate?: (errors: Record<string, string>) => void;
}

const MantineSelect: React.FC<IMantineSelectProps> = ({
    id,
    name,
    value,
    onChange,
    required,
    translateFn,
    onValidate,
    ...rest
}) => {
    const [error, setError] = React.useState<string | undefined>();

    React.useEffect(() => {
        if (!required || !translateFn) return;

        if (!value) {
            const msg = translateFn('validations.isRequired');
            setError(msg);
            if (onValidate) onValidate({ [id]: msg });
        } else {
            setError(undefined);
            if (onValidate) onValidate({});
        }
    }, [value, required, id, translateFn, onValidate]);

    return (
        <Select
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            error={error}
            {...rest}
        />
    );
};

export default MantineSelect;
