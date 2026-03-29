import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../BaseButton';
import { ITherrThemeColors } from '../../../styles/themes';
import spacingStyles from '../../../styles/layouts/spacing';

interface IInviteFriendsProps {
    onSkip: () => void;
    onShareLink: () => void;
    onSyncContacts: () => void;
    translate: Function;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeSettingsForm: {
        styles: any;
    };
}

const InviteFriends: React.FC<IInviteFriendsProps> = ({
    onSkip,
    onShareLink,
    onSyncContacts,
    translate,
    theme,
    themeForms,
    themeSettingsForm,
}) => {
    return (
        <View style={themeSettingsForm.styles.userContainer}>
            <View style={spacingStyles.marginBotLg}>
                <Text style={[theme.styles.sectionDescription, localStyles.descriptionText]}>
                    {translate('pages.createProfile.inviteFriends.description')}
                </Text>
                <Button
                    containerStyle={localStyles.buttonSpacing}
                    buttonStyle={themeForms.styles.button}
                    titleStyle={themeForms.styles.buttonTitle}
                    title={translate('pages.createProfile.inviteFriends.shareLink')}
                    onPress={onShareLink}
                />
                <Button
                    containerStyle={localStyles.buttonSpacing}
                    buttonStyle={themeForms.styles.buttonRoundAlt}
                    titleStyle={themeForms.styles.buttonTitleAlt}
                    title={translate('pages.createProfile.inviteFriends.syncContacts')}
                    type="outline"
                    onPress={onSyncContacts}
                />
            </View>
            <View style={themeSettingsForm.styles.submitButtonContainer}>
                <Button
                    buttonStyle={themeForms.styles.buttonRoundAlt}
                    titleStyle={themeForms.styles.buttonTitleAlt}
                    title={translate('pages.createProfile.inviteFriends.skip')}
                    type="clear"
                    onPress={onSkip}
                />
            </View>
        </View>
    );
};

const localStyles = StyleSheet.create({
    descriptionText: {
        textAlign: 'center',
        marginBottom: 20,
    },
    buttonSpacing: {
        marginBottom: 15,
    },
});

export default InviteFriends;
