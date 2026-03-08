import * as React from 'react';
import {
    PasswordInput,
    PasswordInputProps,
    TextInput,
    TextInputProps,
} from '@mantine/core';
import isValidInput from 'therr-js-utilities/is-valid-input';
import VALIDATIONS from '../../constants/VALIDATIONS';

interface IMantineInputProps extends Omit<TextInputProps, 'onChange'> {
    id: string;
    name: string;
    value: string;
    onChange: (name: string, value: string) => void;
    onEnter?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    validations?: string[];
    translateFn?: (key: string, params?: Record<string, string>) => string;
    onValidate?: (errors: Record<string, string>) => void;
}

const MantineInput = React.forwardRef<HTMLInputElement, IMantineInputProps>(({
    id,
    name,
    value,
    onChange,
    onEnter,
    type,
    validations = [],
    translateFn,
    onValidate,
    ...rest
}, ref) => {
    const [isDirty, setIsDirty] = React.useState(false);
    const [isTouched, setIsTouched] = React.useState(false);
    const [error, setError] = React.useState<string | undefined>();

    React.useEffect(() => {
        if (validations.length === 0 || !translateFn) return;

        const errors: string[] = [];
        validations.forEach((key) => {
            if (!isValidInput(VALIDATIONS, key, value)) {
                errors.push(
                    translateFn(
                        VALIDATIONS[key].errorMessageLocalizationKey,
                        { value },
                    ),
                );
            }
        });

        const errorMsg = errors.length > 0 ? errors[0] : undefined;

        if (isTouched || isDirty) {
            setError(errorMsg);
        }

        if (onValidate) {
            onValidate(errorMsg ? { [id]: errorMsg } : {});
        }
    }, [value, validations, id, translateFn, onValidate, isTouched, isDirty]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setIsDirty(true);
        onChange(name, e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (onEnter && e.key === 'Enter') {
            onEnter(e);
        }
    };

    const handleFocus = () => setIsTouched(true);

    const sharedProps = {
        id,
        name,
        ref,
        value: value || '',
        onChange: handleChange,
        onKeyDown: onEnter ? handleKeyDown : undefined,
        onFocus: handleFocus,
        error,
        ...rest,
    };

    if (type === 'password') {
        return (
            <PasswordInput
                {...(sharedProps as PasswordInputProps)}
            />
        );
    }

    return (
        <TextInput
            type={type}
            {...sharedProps}
        />
    );
});

MantineInput.displayName = 'MantineInput';

export default MantineInput;
