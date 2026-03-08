import * as React from 'react';
import { TextInput, TextInputProps } from '@mantine/core';
import isValidInput from 'therr-js-utilities/is-valid-input';
import VALIDATIONS from '../../constants/VALIDATIONS';

interface IMantineInputProps extends Omit<TextInputProps, 'onChange'> {
    id: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    validations?: string[];
    translateFn?: (key: string, params?: Record<string, string>) => string;
    onValidate?: (errors: Record<string, string>) => void;
}

const MantineInput: React.FC<IMantineInputProps> = ({
    id,
    name,
    value,
    onChange,
    validations = [],
    translateFn,
    onValidate,
    ...rest
}) => {
    const [error, setError] = React.useState<string | undefined>();

    React.useEffect(() => {
        if (validations.length === 0 || !translateFn) return;

        const errors: string[] = [];
        validations.forEach((key) => {
            if (!isValidInput(VALIDATIONS, key, value)) {
                errors.push(translateFn(VALIDATIONS[key].errorMessageLocalizationKey, { value }));
            }
        });

        const errorMsg = errors.length > 0 ? errors[0] : undefined;
        setError(errorMsg);

        if (onValidate) {
            onValidate(errorMsg ? { [id]: errorMsg } : {});
        }
    }, [value, validations, id, translateFn, onValidate]);

    return (
        <TextInput
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            error={error}
            {...rest}
        />
    );
};

export default MantineInput;
