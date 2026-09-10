import React from 'react';
import { Linking, Text } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

interface IBackgroundLocationDisclosureModalProps {
    isVisible: boolean;
    onAccept: () => void;
    onDecline: () => void;
    translate: Function;
    themeDisclosure: {
        styles: any;
    };
}

const PRIVACY_POLICY_URL = 'https://www.therr.app/privacy-policy.html';

const BackgroundLocationDisclosureModal = ({
    isVisible,
    onAccept,
    onDecline,
    translate,
    themeDisclosure,
}: IBackgroundLocationDisclosureModalProps) => (
    <Portal>
        <Dialog
            visible={isVisible}
            onDismiss={onDecline}
            style={themeDisclosure.styles.container}
            dismissable={false}
        >
            <Dialog.Title style={themeDisclosure.styles.header}>
                {translate('permissions.backgroundLocation.header')}
            </Dialog.Title>
            <Dialog.Content>
                <Text style={[themeDisclosure.styles.text, { fontWeight: 'bold', marginBottom: 8 }]}>
                    {translate('permissions.backgroundLocation.description1')}
                </Text>
                <Text style={themeDisclosure.styles.text}>
                    {translate('permissions.backgroundLocation.description2')}
                </Text>
                <Text
                    style={[themeDisclosure.styles.text, { marginTop: 8, textDecorationLine: 'underline' }]}
                    onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
                >
                    {translate('permissions.backgroundLocation.privacyPolicy')}
                </Text>
            </Dialog.Content>
            <Dialog.Actions>
                <Button
                    mode="text"
                    onPress={onDecline}
                >
                    {translate('permissions.backgroundLocation.decline')}
                </Button>
                <Button
                    mode="contained"
                    onPress={onAccept}
                >
                    {translate('permissions.backgroundLocation.accept')}
                </Button>
            </Dialog.Actions>
        </Dialog>
    </Portal>
);

export default BackgroundLocationDisclosureModal;
