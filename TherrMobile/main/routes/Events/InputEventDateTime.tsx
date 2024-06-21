import React from 'react';
import DatePicker from 'react-native-date-picker';


const InputEventDateTime = ({
    isDatePickerOpen,
    isTimePickerOpen,
    isNightMode,
    onCancel,
    onConfirm,
    value,
}) => {
    return (
        <>
            <DatePicker
                modal
                mode="date"
                open={isDatePickerOpen}
                date={value}
                onConfirm={onConfirm}
                onCancel={onCancel}
                theme={isNightMode ? 'dark' : 'light'}
            />
            <DatePicker
                modal
                mode="time"
                open={isTimePickerOpen}
                date={value}
                onConfirm={onConfirm}
                onCancel={onCancel}
                theme={isNightMode ? 'dark' : 'light'}
            />
        </>
    );
};

export default InputEventDateTime;
