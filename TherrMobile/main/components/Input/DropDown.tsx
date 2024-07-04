import React, { useState } from 'react';
import { Picker as ReactPicker } from '@react-native-picker/picker';

interface IDropDownProps {
    enabled?: boolean;
    onChange: (newValue: null | string) => any;
    options: any[];
    initialValue?: string;
    formStyles: {
        pickerFlex: any;
        pickerItem: any;
    };
    style?: any;
}

export default ({
    enabled = true,
    onChange,
    options,
    initialValue,
    style,
    formStyles,
}: IDropDownProps) => {
    const [value, setValue] = useState<null|string>(null);
    if (value == null && value !== '' && initialValue !== undefined) {
        setValue(initialValue);
    }

    return (
        <ReactPicker
            enabled={enabled}
            selectedValue={value}
            style={style || formStyles.pickerFlex}
            itemStyle={formStyles.pickerItem}
            onValueChange={(newValue) => {
                onChange(newValue);
                setValue(newValue);
            }}>
            {
                options.map(option => (
                    <ReactPicker.Item key={option.id} label={option.label} value={option.value} />
                ))
            }
        </ReactPicker>
    );
};
