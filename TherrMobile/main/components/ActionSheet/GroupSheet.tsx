import React from 'react';
import { Text, View } from 'react-native';
import ActionSheet, { SheetProps } from 'react-native-actions-sheet';
import { Button } from 'react-native-elements';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import spacingStyles from '../../styles/layouts/spacing';
import TherrIcon from '../TherrIcon';

const GroupSheet = (props: SheetProps<'group-sheet'>) => {
    return (
        <ActionSheet id={props.sheetId}>
            <View style={[
                spacingStyles.fullWidth,
                spacingStyles.alignStart,
                spacingStyles.marginTopMd,
                spacingStyles.marginBotLg,
            ]}>
                <Text numberOfLines={1} style={[
                    spacingStyles.fullWidth,
                    spacingStyles.padMd,
                    spacingStyles.alignCenter,
                    spacingStyles.marginBotSm,
                    spacingStyles.textCenter,
                    {
                        color: props.payload?.themeForms.colors.brandingWhite,
                        backgroundColor: props.payload?.themeForms.colors.brandingBlueGreen,
                    },
                ]}>
                    {props.payload?.translate('actionSheets.group.header', {
                        groupName: props.payload?.group.title,
                    })}
                </Text>
                <Button
                    type="clear"
                    buttonStyle={spacingStyles.justifyStart}
                    containerStyle={[spacingStyles.fullWidth]}
                    titleStyle={props.payload?.themeForms.styles.buttonLink}
                    title={props.payload?.translate(
                        'actionSheets.group.buttons.share'
                    )}
                    onPress={() => props.payload?.onPressShareGroup(props.payload?.group)}
                    icon={
                        <TherrIcon
                            style={spacingStyles.marginRtMd}
                            name="share"
                            size={22}
                            color={props.payload?.themeForms.colors.primary3}
                        />}
                />
                {
                    props.payload?.hasGroupEditAccess &&
                    <Button
                        type="clear"
                        buttonStyle={spacingStyles.justifyStart}
                        containerStyle={[spacingStyles.fullWidth]}
                        titleStyle={props.payload?.themeForms.styles.buttonLink}
                        title={props.payload?.translate(
                            'actionSheets.group.buttons.edit'
                        )}
                        onPress={() => props.payload?.onPressEditGroup(props.payload?.group)}
                        icon={
                            <TherrIcon
                                style={spacingStyles.marginRtMd}
                                name="edit"
                                size={22}
                                color={props.payload?.themeForms.colors.primary3}
                            />}
                    />
                }
                {
                    props.payload?.isGroupMember &&
                    <Button
                        type="clear"
                        buttonStyle={spacingStyles.justifyStart}
                        containerStyle={[spacingStyles.fullWidth]}
                        titleStyle={props.payload?.themeForms.styles.buttonLink}
                        title={props.payload?.translate(
                            'actionSheets.group.buttons.leave'
                        )}
                        onPress={() => props.payload?.onPressLeaveGroup(props.payload?.group)}
                        icon={
                            <TherrIcon
                                style={spacingStyles.marginRtMd}
                                name="door-open"
                                size={22}
                                color={props.payload?.themeForms.colors.primary3}
                            />}
                    />
                }
                {
                    props.payload?.hasGroupArchiveAccess &&
                    <Button
                        type="clear"
                        buttonStyle={spacingStyles.justifyStart}
                        containerStyle={[spacingStyles.fullWidth]}
                        titleStyle={props.payload?.themeForms.styles.buttonLinkAlert}
                        title={props.payload?.translate(
                            'actionSheets.group.buttons.archive'
                        )}
                        onPress={() => props.payload?.onPressArchiveGroup(props.payload?.group)}
                        icon={
                            <FontAwesome5Icon
                                style={spacingStyles.marginRtMd}
                                name="trash-alt"
                                size={22}
                                color={props.payload?.themeForms.colors.alertError}
                            />}
                    />
                }
            </View>
        </ActionSheet>
    );
};

export default GroupSheet;
