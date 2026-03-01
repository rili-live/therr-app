import React from 'react';
import { View } from 'react-native';
import ActionSheet, { SheetManager, SheetProps } from 'react-native-actions-sheet';
import { Button } from 'react-native-elements';
import OctIcon from 'react-native-vector-icons/Octicons';
import spacingStyles from '../../styles/layouts/spacing';

const ImagePickerSheet = (props: SheetProps<'image-picker-sheet'>) => {
    const { payload } = props;

    return (
        <ActionSheet id={props.sheetId}>
            <View style={[
                spacingStyles.fullWidth,
                spacingStyles.alignStart,
                spacingStyles.marginTopMd,
                spacingStyles.marginBotLg,
                spacingStyles.padHorizMd,
            ]}>
                <Button
                    containerStyle={{ marginBottom: 10, width: '100%' }}
                    buttonStyle={payload?.themeForms.styles.buttonRound}
                    disabledStyle={payload?.themeForms.styles.buttonRoundDisabled}
                    disabledTitleStyle={payload?.themeForms.styles.buttonTitleDisabled}
                    titleStyle={payload?.themeForms.styles.buttonTitle}
                    title={payload?.galleryText}
                    onPress={() => {
                        SheetManager.hide('image-picker-sheet');
                        payload?.onSelect('upload');
                    }}
                    raised={false}
                    icon={
                        <OctIcon
                            name="plus"
                            size={22}
                            style={payload?.themeForms.styles.buttonIcon}
                        />
                    }
                />
                <Button
                    containerStyle={spacingStyles.fullWidth}
                    buttonStyle={payload?.themeForms.styles.buttonRound}
                    disabledStyle={payload?.themeForms.styles.buttonRoundDisabled}
                    disabledTitleStyle={payload?.themeForms.styles.buttonTitleDisabled}
                    titleStyle={payload?.themeForms.styles.buttonTitle}
                    title={payload?.cameraText}
                    onPress={() => {
                        SheetManager.hide('image-picker-sheet');
                        payload?.onSelect('camera');
                    }}
                    raised={false}
                    icon={
                        <OctIcon
                            name="device-camera"
                            size={22}
                            style={payload?.themeForms.styles.buttonIcon}
                        />
                    }
                />
            </View>
        </ActionSheet>
    );
};

export default ImagePickerSheet;
