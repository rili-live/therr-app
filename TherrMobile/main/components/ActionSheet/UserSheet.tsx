import React from 'react';
import { Text, View } from 'react-native';
import ActionSheet, { SheetProps } from 'react-native-actions-sheet';
import { Button } from 'react-native-elements';
import spacingStyles from '../../styles/layouts/spacing';
import TherrIcon from '../TherrIcon';

const UserSheet = (props: SheetProps<'user-sheet'>) => {
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
                    {props.payload?.translate('actionSheets.user.header', {
                        userName: props.payload?.userInView?.userName,
                    })}
                </Text>
                <Button
                    type="clear"
                    buttonStyle={spacingStyles.justifyStart}
                    containerStyle={[spacingStyles.fullWidth]}
                    titleStyle={[props.payload?.themeForms.styles.buttonLink, { color: props.payload?.themeForms.colors.primary3 }]}
                    title={props.payload?.translate(
                        'actionSheets.user.buttons.type5'
                    )}
                    onPress={() => props.payload?.onPressUpdatedConnectionType(props.payload?.userInView?.id, 5)}
                    icon={
                        props.payload?.userInView?.connectionType === 5 ?
                            <TherrIcon
                                style={spacingStyles.marginRtMd}
                                name="star-filled"
                                size={22}
                                color={props.payload?.themeForms.colors.primary3}
                            /> :
                            undefined
                    }
                />
                <Button
                    type="clear"
                    buttonStyle={spacingStyles.justifyStart}
                    containerStyle={[spacingStyles.fullWidth]}
                    titleStyle={[props.payload?.themeForms.styles.buttonLink, { color: props.payload?.themeForms.colors.primary3 }]}
                    title={props.payload?.translate(
                        'actionSheets.user.buttons.type4'
                    )}
                    onPress={() => props.payload?.onPressUpdatedConnectionType(props.payload?.userInView?.id, 4)}
                    icon={
                        props.payload?.userInView?.connectionType === 4 ?
                            <TherrIcon
                                style={spacingStyles.marginRtMd}
                                name="star-filled"
                                size={22}
                                color={props.payload?.themeForms.colors.primary3}
                            /> :
                            undefined
                    }
                />
                <Button
                    type="clear"
                    buttonStyle={spacingStyles.justifyStart}
                    containerStyle={[spacingStyles.fullWidth]}
                    titleStyle={[props.payload?.themeForms.styles.buttonLink, { color: props.payload?.themeForms.colors.primary3 }]}
                    title={props.payload?.translate(
                        'actionSheets.user.buttons.type3'
                    )}
                    onPress={() => props.payload?.onPressUpdatedConnectionType(props.payload?.userInView?.id, 3)}
                    icon={
                        props.payload?.userInView?.connectionType === 3 ?
                            <TherrIcon
                                style={spacingStyles.marginRtMd}
                                name="star-filled"
                                size={22}
                                color={props.payload?.themeForms.colors.primary3}
                            /> :
                            undefined
                    }
                />
                <Button
                    type="clear"
                    buttonStyle={spacingStyles.justifyStart}
                    containerStyle={[spacingStyles.fullWidth]}
                    titleStyle={[props.payload?.themeForms.styles.buttonLink, { color: props.payload?.themeForms.colors.primary3 }]}
                    title={props.payload?.translate(
                        'actionSheets.user.buttons.type2'
                    )}
                    onPress={() => props.payload?.onPressUpdatedConnectionType(props.payload?.userInView?.id, 2)}
                    icon={
                        props.payload?.userInView?.connectionType === 2 ?
                            <TherrIcon
                                style={spacingStyles.marginRtMd}
                                name="star-half"
                                size={22}
                                color={props.payload?.themeForms.colors.primary3}
                            /> :
                            undefined
                    }
                />
                <Button
                    type="clear"
                    buttonStyle={spacingStyles.justifyStart}
                    containerStyle={[spacingStyles.fullWidth]}
                    titleStyle={[props.payload?.themeForms.styles.buttonLink, { color: props.payload?.themeForms.colors.primary3 }]}
                    title={props.payload?.translate(
                        'actionSheets.user.buttons.type1'
                    )}
                    onPress={() => props.payload?.onPressUpdatedConnectionType(props.payload?.userInView?.id, 1)}
                    icon={
                        props.payload?.userInView?.connectionType === 1 ?
                            <TherrIcon
                                style={spacingStyles.marginRtMd}
                                name="star"
                                size={22}
                                color={props.payload?.themeForms.colors.primary3}
                            /> :
                            undefined
                    }
                />
            </View>
        </ActionSheet>
    );
};

export default UserSheet;
