import React from 'react';
import { Text, View } from 'react-native';
import ActionSheet, { SheetManager, SheetProps } from 'react-native-actions-sheet';
import { List } from 'react-native-paper';
import spacingStyles from '../../styles/layouts/spacing';
import { bottomSafeAreaInset } from '../../styles/navigation/buttonMenu';
import TherrIcon from '../TherrIcon';

const UserSheet = (props: SheetProps<'user-sheet'>) => {
    const { payload } = props;
    const iconColor = payload?.themeForms.colors.primary3;

    const connectionTypes = [
        { type: 5, icon: 'star-filled' },
        { type: 4, icon: 'star-filled' },
        { type: 3, icon: 'star-filled' },
        { type: 2, icon: 'star-half' },
        { type: 1, icon: 'star' },
    ];

    return (
        <ActionSheet id={props.sheetId}>
            <View style={[
                spacingStyles.fullWidth,
                spacingStyles.marginTopMd,
                spacingStyles.marginBotLg,
                { paddingBottom: bottomSafeAreaInset },
            ]}>
                <Text numberOfLines={1} style={[
                    spacingStyles.fullWidth,
                    spacingStyles.padMd,
                    spacingStyles.alignCenter,
                    spacingStyles.marginBotSm,
                    spacingStyles.textCenter,
                    {
                        color: payload?.themeForms.colors.brandingWhite,
                        backgroundColor: payload?.themeForms.colors.brandingBlueGreen,
                    },
                ]}>
                    {payload?.translate('actionSheets.user.header', {
                        userName: payload?.userInView?.userName,
                    })}
                </Text>
                {connectionTypes.map(({ type, icon }) => (
                    <List.Item
                        key={type}
                        title={payload?.translate(`actionSheets.user.buttons.type${type}`)}
                        titleStyle={{ color: iconColor }}
                        left={(listProps) => (
                            <TherrIcon
                                name={icon}
                                size={22}
                                color={payload?.userInView?.connectionType === type ? iconColor : 'transparent'}
                                style={listProps.style}
                            />
                        )}
                        onPress={() => {
                            SheetManager.hide('user-sheet');
                            payload?.onPressUpdatedConnectionType(payload?.userInView?.id, type);
                        }}
                    />
                ))}
            </View>
        </ActionSheet>
    );
};

export default UserSheet;
