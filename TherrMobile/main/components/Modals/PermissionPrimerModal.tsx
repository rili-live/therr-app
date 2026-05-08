import React from 'react';
import { Text } from 'react-native';
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

const PermissionPrimerModal = ({
    permissionType,
    isVisible,
    onAllow,
    onNotNow,
    translate,
    themeDisclosure,
}: IPermissionPrimerModalProps) => {
    const titleKey = `permissions.primer.${permissionType}.title`;
    const bodyKey = `permissions.primer.${permissionType}.body`;

    return (
        <Portal>
            <Dialog
                visible={isVisible}
                onDismiss={onNotNow}
                style={themeDisclosure.styles.container}
            >
                <Dialog.Title style={themeDisclosure.styles.header}>
                    {translate(titleKey)}
                </Dialog.Title>
                <Dialog.Content>
                    <Text style={themeDisclosure.styles.text}>{translate(bodyKey)}</Text>
                </Dialog.Content>
                <Dialog.Actions>
                    <Button
                        mode="text"
                        onPress={onNotNow}
                    >
                        {translate('permissions.primer.shared.notNow')}
                    </Button>
                    <Button
                        mode="contained"
                        icon="check"
                        onPress={onAllow}
                    >
                        {translate('permissions.primer.shared.allow')}
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

export default PermissionPrimerModal;
