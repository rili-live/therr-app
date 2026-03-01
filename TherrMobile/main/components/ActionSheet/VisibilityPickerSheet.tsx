import React from 'react';
import { View } from 'react-native';
import ActionSheet, { SheetManager, SheetProps } from 'react-native-actions-sheet';
import { Button } from '../BaseButton';
import OctIcon from 'react-native-vector-icons/Octicons';
import spacingStyles from '../../styles/layouts/spacing';
import { bottomSafeAreaInset } from '../../styles/navigation/buttonMenu';

const VisibilityPickerSheet = (props: SheetProps<'visibility-picker-sheet'>) => {
    const { payload } = props;

    return (
        <ActionSheet id={props.sheetId}>
            <View style={[
                spacingStyles.fullWidth,
                spacingStyles.alignStart,
                spacingStyles.marginTopMd,
                spacingStyles.marginBotLg,
                spacingStyles.padHorizMd,
                { paddingBottom: bottomSafeAreaInset },
            ]}>
                <Button
                    containerStyle={{ marginBottom: 10, width: '100%' }}
                    buttonStyle={payload?.themeForms.styles.buttonRound}
                    disabledStyle={payload?.themeForms.styles.buttonRoundDisabled}
                    disabledTitleStyle={payload?.themeForms.styles.buttonTitleDisabled}
                    titleStyle={payload?.themeForms.styles.buttonTitle}
                    title={payload?.publicText}
                    onPress={() => {
                        SheetManager.hide('visibility-picker-sheet');
                        payload?.onSelect(true);
                    }}
                    raised={false}
                    icon={
                        <OctIcon
                            name="globe"
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
                    title={payload?.privateText}
                    onPress={() => {
                        SheetManager.hide('visibility-picker-sheet');
                        payload?.onSelect(false);
                    }}
                    raised={false}
                    icon={
                        <OctIcon
                            name="people"
                            size={22}
                            style={payload?.themeForms.styles.buttonIcon}
                        />
                    }
                />
            </View>
        </ActionSheet>
    );
};

export default VisibilityPickerSheet;
