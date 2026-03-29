import React from 'react';
import { View } from 'react-native';
import ActionSheet, { SheetManager, SheetProps } from 'react-native-actions-sheet';
import { List } from 'react-native-paper';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import spacingStyles from '../../styles/layouts/spacing';
import { bottomSafeAreaInset } from '../../styles/navigation/buttonMenu';

export interface IUserProfileAction {
    id: string;
    name: string;
    icon: string;
    title: string;
}

const UserProfileIcon = ({ iconName, iconColor, style }: { iconName: string; iconColor: string | undefined; style: any }) => (
    <MaterialIcon
        name={iconName}
        size={22}
        color={iconColor}
        style={style}
    />
);

const UserProfileSheet = (props: SheetProps<'user-profile-sheet'>) => {
    const { payload } = props;
    const actions = payload?.actions || [];
    const iconColor = payload?.themeForms.colors.primary3;

    return (
        <ActionSheet id={props.sheetId}>
            <View style={[
                spacingStyles.fullWidth,
                spacingStyles.marginTopMd,
                spacingStyles.marginBotLg,
                { paddingBottom: bottomSafeAreaInset },
            ]}>
                {actions.map((item) => (
                    <List.Item
                        key={item.id}
                        title={payload?.translate(item.title)}
                        titleStyle={{ color: iconColor }}
                        left={(listProps) => (
                            <UserProfileIcon iconName={item.icon} iconColor={iconColor} style={listProps.style} />
                        )}
                        onPress={() => {
                            SheetManager.hide('user-profile-sheet');
                            payload?.onAction(item);
                        }}
                    />
                ))}
            </View>
        </ActionSheet>
    );
};

export default UserProfileSheet;
