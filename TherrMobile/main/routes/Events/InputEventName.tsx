import React from 'react';
import RoundInput from '../../components/Input/Round';


const InputEventName = ({
    onChangeText,
    themeForms,
    translate,
    value,
}) => {
    return (
        <RoundInput
            maxLength={100}
            placeholder={translate(
                'forms.editEvent.labels.notificationMsg'
            )}
            value={value}
            onChangeText={onChangeText}
            themeForms={themeForms}
        />
    );
};

export default InputEventName;
