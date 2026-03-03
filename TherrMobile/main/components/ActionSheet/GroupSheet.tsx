import React from 'react';
import { Text, View } from 'react-native';
import ActionSheet, { SheetManager, SheetProps } from 'react-native-actions-sheet';
import { List } from 'react-native-paper';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import spacingStyles from '../../styles/layouts/spacing';
import { bottomSafeAreaInset } from '../../styles/navigation/buttonMenu';
import TherrIcon from '../TherrIcon';

const GroupSheet = (props: SheetProps<'group-sheet'>) => {
    const { payload } = props;
    const iconColor = payload?.themeForms.colors.primary3;

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
                    {payload?.translate('actionSheets.group.header', {
                        groupName: payload?.group.title,
                    })}
                </Text>
                <List.Item
                    title={payload?.translate('actionSheets.group.buttons.share')}
                    titleStyle={{ color: iconColor }}
                    left={(listProps) => (
                        <TherrIcon
                            name="share"
                            size={22}
                            color={iconColor}
                            style={listProps.style}
                        />
                    )}
                    onPress={() => {
                        SheetManager.hide('group-sheet');
                        payload?.onPressShareGroup(payload?.group);
                    }}
                />
                {
                    payload?.hasGroupEditAccess &&
                    <List.Item
                        title={payload?.translate('actionSheets.group.buttons.edit')}
                        titleStyle={{ color: iconColor }}
                        left={(listProps) => (
                            <TherrIcon
                                name="edit"
                                size={22}
                                color={iconColor}
                                style={listProps.style}
                            />
                        )}
                        onPress={() => {
                            SheetManager.hide('group-sheet');
                            payload?.onPressEditGroup(payload?.group);
                        }}
                    />
                }
                {
                    payload?.isGroupMember &&
                    <List.Item
                        title={payload?.translate('actionSheets.group.buttons.leave')}
                        titleStyle={{ color: iconColor }}
                        left={(listProps) => (
                            <TherrIcon
                                name="door-open"
                                size={22}
                                color={iconColor}
                                style={listProps.style}
                            />
                        )}
                        onPress={() => {
                            SheetManager.hide('group-sheet');
                            payload?.onPressLeaveGroup(payload?.group);
                        }}
                    />
                }
                {
                    payload?.canJoinGroup &&
                    <List.Item
                        title={payload?.translate('actionSheets.group.buttons.join')}
                        titleStyle={{ color: iconColor }}
                        left={(listProps) => (
                            <TherrIcon
                                name="plus"
                                size={22}
                                color={iconColor}
                                style={listProps.style}
                            />
                        )}
                        onPress={() => {
                            SheetManager.hide('group-sheet');
                            payload?.onPressJoinGroup(payload?.group);
                        }}
                    />
                }
                {
                    payload?.hasGroupArchiveAccess &&
                    <List.Item
                        title={payload?.translate('actionSheets.group.buttons.archive')}
                        titleStyle={{ color: payload?.themeForms.colors.alertError }}
                        left={(listProps) => (
                            <FontAwesome5Icon
                                name="trash-alt"
                                size={22}
                                color={payload?.themeForms.colors.alertError}
                                style={listProps.style}
                            />
                        )}
                        onPress={() => {
                            SheetManager.hide('group-sheet');
                            payload?.onPressArchiveGroup(payload?.group);
                        }}
                    />
                }
            </View>
        </ActionSheet>
    );
};

export default GroupSheet;
