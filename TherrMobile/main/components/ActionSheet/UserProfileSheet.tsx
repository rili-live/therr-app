import React from 'react';
import { View } from 'react-native';
import ActionSheet, { SheetManager, SheetProps } from 'react-native-actions-sheet';
import { Button } from '../BaseButton';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import spacingStyles from '../../styles/layouts/spacing';
import { bottomSafeAreaInset } from '../../styles/navigation/buttonMenu';

export interface IUserProfileAction {
    id: string;
    name: string;
    icon: string;
    title: string;
}

const UserProfileSheet = (props: SheetProps<'user-profile-sheet'>) => {
    const { payload } = props;
    const actions = payload?.actions || [];

    return (
        <ActionSheet id={props.sheetId}>
            <View style={[
                spacingStyles.fullWidth,
                spacingStyles.alignStart,
                spacingStyles.marginTopMd,
                spacingStyles.marginBotLg,
                { paddingBottom: bottomSafeAreaInset },
            ]}>
                {actions.map((item) => (
                    <Button
                        key={item.id}
                        type="clear"
                        buttonStyle={spacingStyles.justifyStart}
                        containerStyle={[spacingStyles.fullWidth]}
                        titleStyle={[payload?.themeForms.styles.buttonLink, { color: payload?.themeForms.colors.primary3 }]}
                        title={payload?.translate(item.title)}
                        onPress={() => {
                            SheetManager.hide('user-profile-sheet');
                            payload?.onAction(item);
                        }}
                        icon={
                            <MaterialIcon
                                style={spacingStyles.marginRtMd}
                                name={item.icon}
                                size={22}
                                color={payload?.themeForms.colors.primary3}
                            />
                        }
                    />
                ))}
            </View>
        </ActionSheet>
    );
};

export default UserProfileSheet;
