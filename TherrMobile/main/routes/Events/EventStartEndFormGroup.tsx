import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from 'react-native-elements';
import OctIcon from 'react-native-vector-icons/Octicons';
import spacingStyles from '../../styles/layouts/spacing';
import formatDate from '../../utilities/formatDate';
import InputEventDateTime from './InputEventDateTime';

const EventStartEndFormGroup = ({
    isNightMode,
    onConfirm,
    themeForms,
    translate,
    startsAtValue,
    stopsAtValue,
}) => {
    const [isStartDatePickerOpen, setStartDatePickerOpen] = useState(false);
    const [isEndDatePickerOpen, setEndDatePickerOpen] = useState(false);
    const [isStartTimePickerOpen, setStartTimePickerOpen] = useState(false);
    const [isEndTimePickerOpen, setEndTimePickerOpen] = useState(false);
    const openDatePicker = (variation: 'start' | 'end') => {
        if (variation === 'start') {
            setStartDatePickerOpen(!isStartDatePickerOpen);
        } else if (variation === 'end') {
            setEndDatePickerOpen(!isEndDatePickerOpen);
        }
    };
    const openTimePicker = (variation: 'start' | 'end') => {
        if (variation === 'start') {
            setStartTimePickerOpen(!isStartTimePickerOpen);
        } else if (variation === 'end') {
            setEndTimePickerOpen(!isEndTimePickerOpen);
        }
    };
    const onCancel = () => {
        setStartDatePickerOpen(false);
        setEndDatePickerOpen(false);
        setStartTimePickerOpen(false);
        setEndTimePickerOpen(false);
    };
    const onConfirmDatePicker = (variation: 'start' | 'end', date) => {
        onConfirm(variation, date);

        onCancel();
    };


    return (
        <>
            <View style={[
                spacingStyles.flexRow,
                spacingStyles.justifyBetween,
                spacingStyles.alignCenter,
            ]}>
                <Text style={[
                    themeForms.styles.label,
                    spacingStyles.marginBotLg,
                    spacingStyles.padRtSm,
                    spacingStyles.minWidthMd,
                ]}>
                    {translate('forms.editEvent.buttons.startsAt')}
                </Text>
                <Button
                    containerStyle={[spacingStyles.marginBotLg, spacingStyles.flexOne, spacingStyles.padRtSm]}
                    buttonStyle={themeForms.styles.buttonRoundAlt}
                    // disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                    disabledStyle={themeForms.styles.buttonRoundDisabled}
                    disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                    titleStyle={themeForms.styles.buttonTitleAlt}
                    title={startsAtValue
                        ? formatDate(startsAtValue, 'short').date
                        : translate('forms.editEvent.buttons.startsAt')}
                    type="outline"
                    onPress={() => openDatePicker('start')}
                    raised={false}
                    icon={
                        <OctIcon
                            name={'calendar'}
                            size={22}
                            style={themeForms.styles.buttonIconAlt}
                        />
                    }
                />
                <Button
                    containerStyle={[spacingStyles.marginBotLg, spacingStyles.flexOne, spacingStyles.padLtSm]}
                    buttonStyle={themeForms.styles.buttonRoundAlt}
                    // disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                    disabledStyle={themeForms.styles.buttonRoundDisabled}
                    disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                    titleStyle={themeForms.styles.buttonTitleAlt}
                    title={startsAtValue
                        ? formatDate(startsAtValue, 'short').time
                        : translate('forms.editEvent.buttons.startsAt')}
                    type="outline"
                    onPress={() => openTimePicker('start')}
                    raised={false}
                    icon={
                        <OctIcon
                            name={'clock'}
                            size={22}
                            style={themeForms.styles.buttonIconAlt}
                        />
                    }
                />
                <InputEventDateTime
                    isDatePickerOpen={isStartDatePickerOpen}
                    isTimePickerOpen={isStartTimePickerOpen}
                    onConfirm={(date) => onConfirmDatePicker('start', date)}
                    onCancel={onCancel}
                    isNightMode={isNightMode}
                    value={startsAtValue}
                />
            </View>
            <View style={[
                spacingStyles.padBotMd,
                spacingStyles.flexRow,
                spacingStyles.justifyBetween,
                spacingStyles.alignCenter,
            ]}>
                <Text style={[
                    themeForms.styles.label,
                    spacingStyles.marginBotLg,
                    spacingStyles.padRtSm,
                    spacingStyles.minWidthMd,
                ]}>
                    {translate('forms.editEvent.buttons.endsAt')}
                </Text>
                <Button
                    containerStyle={[spacingStyles.marginBotLg, spacingStyles.flexOne, spacingStyles.padRtSm]}
                    buttonStyle={themeForms.styles.buttonRoundAlt}
                    // disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                    disabledStyle={themeForms.styles.buttonRoundDisabled}
                    disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                    titleStyle={themeForms.styles.buttonTitleAlt}
                    title={stopsAtValue
                        ? formatDate(stopsAtValue, 'short').date
                        : translate('forms.editEvent.buttons.endsAt')}
                    type="outline"
                    onPress={() => openDatePicker('end')}
                    raised={false}
                    icon={
                        <OctIcon
                            name={'calendar'}
                            size={22}
                            style={themeForms.styles.buttonIconAlt}
                        />
                    }
                />
                <Button
                    containerStyle={[spacingStyles.marginBotLg, spacingStyles.flexOne, spacingStyles.padLtSm]}
                    buttonStyle={themeForms.styles.buttonRoundAlt}
                    // disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                    disabledStyle={themeForms.styles.buttonRoundDisabled}
                    disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                    titleStyle={themeForms.styles.buttonTitleAlt}
                    title={stopsAtValue
                        ? formatDate(stopsAtValue, 'short').time
                        : translate('forms.editEvent.buttons.endsAt')}
                    type="outline"
                    onPress={() => openTimePicker('end')}
                    raised={false}
                    icon={
                        <OctIcon
                            name={'clock'}
                            size={22}
                            style={themeForms.styles.buttonIconAlt}
                        />
                    }
                />
                <InputEventDateTime
                    isDatePickerOpen={isEndDatePickerOpen}
                    isTimePickerOpen={isEndTimePickerOpen}
                    onConfirm={(date) => onConfirmDatePicker('end', date)}
                    onCancel={onCancel}
                    isNightMode={isNightMode}
                    value={stopsAtValue}
                />
            </View>
        </>
    );
};

export default EventStartEndFormGroup;
