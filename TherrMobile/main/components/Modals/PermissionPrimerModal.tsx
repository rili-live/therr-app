import React from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

export type PermissionPrimerType = 'notifications' | 'camera' | 'contacts';

interface IPermissionPrimerModalProps {
    permissionType: PermissionPrimerType;
    isVisible: boolean;
    onAllow: () => void;
    onNotNow: () => void;
    translate: Function;
    themeDisclosure: {
        styles: any;
    };
}

const PRIVACY_POLICY_URL = 'https://www.therr.app/privacy-policy.html';

/**
 * Permission types whose data is uploaded off the device. Google Play requires these to
 * carry a "Prominent Disclosure": an in-app screen that names the data, states that it
 * is sent to our servers and why, and is accepted by an affirmative tap — shown before
 * any collection and never satisfied by the OS permission dialog alone.
 *
 * Version 20 of the Android app was rejected under the User Data policy because the
 * contacts primer said the address book "stays on your device" while
 * `utilities/contacts.ts` was posting it to api.therr.com. The types listed here render
 * the long-form variant below; everything else keeps the one-line primer, which is all a
 * purely on-device permission needs.
 *
 * Adding a type here means also adding `.summary`, `.detail`, and `.optOut` keys under
 * `permissions.primer.<type>` in every locale, and a DISCLOSURE_REVISION entry in
 * `utilities/permissionsOrchestrator.ts` so the consent is actually gated on.
 */
const PROMINENT_DISCLOSURE_TYPES: PermissionPrimerType[] = ['contacts'];

const PermissionPrimerModal = ({
    permissionType,
    isVisible,
    onAllow,
    onNotNow,
    translate,
    themeDisclosure,
}: IPermissionPrimerModalProps) => {
    const isProminentDisclosure = PROMINENT_DISCLOSURE_TYPES.includes(permissionType);
    const titleKey = `permissions.primer.${permissionType}.title`;

    return (
        <Portal>
            <Dialog
                visible={isVisible}
                onDismiss={onNotNow}
                style={themeDisclosure.styles.container}
                // A disclosure must be answered, not dismissed past. The explicit
                // decline below is the opt-out.
                dismissable={!isProminentDisclosure}
            >
                <Dialog.Title style={themeDisclosure.styles.header}>
                    {translate(titleKey)}
                </Dialog.Title>
                {isProminentDisclosure ? (
                    // Scrollable so the whole disclosure stays reachable on small screens
                    // and at large system font sizes — text the user cannot scroll to is
                    // text they were never shown.
                    <Dialog.ScrollArea style={themeDisclosure.styles.scrollArea}>
                        <ScrollView contentContainerStyle={themeDisclosure.styles.scrollContent}>
                            <Text style={[themeDisclosure.styles.text, themeDisclosure.styles.textEmphasis]}>
                                {translate(`permissions.primer.${permissionType}.summary`)}
                            </Text>
                            <Text style={themeDisclosure.styles.text}>
                                {translate(`permissions.primer.${permissionType}.detail`)}
                            </Text>
                            <Text style={themeDisclosure.styles.text}>
                                {translate(`permissions.primer.${permissionType}.optOut`)}
                            </Text>
                            <Text
                                style={[themeDisclosure.styles.text, themeDisclosure.styles.textLink]}
                                accessibilityRole="link"
                                onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
                            >
                                {translate('permissions.primer.shared.privacyPolicy')}
                            </Text>
                        </ScrollView>
                    </Dialog.ScrollArea>
                ) : (
                    <Dialog.Content>
                        <View>
                            <Text style={themeDisclosure.styles.text}>
                                {translate(`permissions.primer.${permissionType}.body`)}
                            </Text>
                        </View>
                    </Dialog.Content>
                )}
                <Dialog.Actions>
                    <Button
                        mode="text"
                        onPress={onNotNow}
                    >
                        {translate(isProminentDisclosure
                            ? 'permissions.primer.shared.decline'
                            : 'permissions.primer.shared.notNow')}
                    </Button>
                    <Button
                        mode="contained"
                        icon="check"
                        onPress={onAllow}
                    >
                        {translate(isProminentDisclosure
                            ? 'permissions.primer.shared.agree'
                            : 'permissions.primer.shared.allow')}
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

export default PermissionPrimerModal;
