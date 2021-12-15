import React, { useState } from 'react';
import { Picker as ReactPicker } from '@react-native-picker/picker';
import formStyles from '../../styles/forms';

interface IDropDownProps {
    onChange: (newValue: null | string) => any;
    options: any[];
    style?: any;
}

export default ({
    onChange,
    options,
    style,
}: IDropDownProps) => {
    const [value, setValue] = useState(null);

    return (
        <ReactPicker
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
