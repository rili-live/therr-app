import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { Button } from '../../BaseButton';
import { ITherrThemeColors } from '../../../styles/themes';
import spacingStyles from '../../../styles/layouts/spacing';
import searchLoading from '../../../assets/search-loading.json';

interface ISyncContactsProps {
    isSyncing: boolean;
    errorMsg?: string;
    onSyncContacts: () => void;
    onSkip: () => void;
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

/**
 * Guided onboarding step that asks permission to match phone contacts against
 * existing users. Declining is a first-class option ("Not Now") — the step is
 * optional and the checklist records the skip rather than nagging.
 */
const SyncContacts: React.FC<ISyncContactsProps> = ({
    isSyncing,
    errorMsg,
    onSyncContacts,
    onSkip,
    translate,
    theme,
    themeForms,
    themeSettingsForm,
}) => (
    <View style={themeSettingsForm.styles.userContainer}>
        <View style={spacingStyles.marginBotLg}>
            <Text style={[theme.styles.sectionDescription, localStyles.descriptionText]}>
                {translate('pages.createProfile.syncContacts.description')}
            </Text>
            <View style={localStyles.graphicContainer}>
                <LottieView
                    source={searchLoading}
                    resizeMode="contain"
                    speed={1}
                    autoPlay
                    loop
                    style={localStyles.graphic}
                />
            </View>
            {
                !!errorMsg &&
                <Text style={[theme.styles.sectionDescriptionNote, localStyles.descriptionText]}>
                    {errorMsg}
                </Text>
            }
        </View>
        <View style={themeSettingsForm.styles.submitButtonContainer}>
            <Button
                containerStyle={localStyles.buttonSpacing}
                buttonStyle={themeForms.styles.buttonPrimary}
                disabledStyle={themeForms.styles.buttonDisabled}
                titleStyle={themeForms.styles.buttonTitle}
                disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                title={translate('pages.createProfile.syncContacts.continue')}
                onPress={onSyncContacts}
                loading={isSyncing}
                disabled={isSyncing}
                raised={false}
            />
            <Button
                buttonStyle={themeForms.styles.buttonRoundAlt}
                titleStyle={themeForms.styles.buttonTitleAlt}
                title={translate('pages.createProfile.syncContacts.skip')}
                type="clear"
                onPress={onSkip}
                disabled={isSyncing}
            />
        </View>
    </View>
);

const localStyles = StyleSheet.create({
    descriptionText: {
        textAlign: 'center',
        marginBottom: 20,
    },
    graphicContainer: {
        width: '100%',
        alignItems: 'center',
    },
    graphic: {
        top: 0,
        width: '100%',
        height: 120,
    },
    buttonSpacing: {
        marginBottom: 15,
    },
});

export default SyncContacts;
