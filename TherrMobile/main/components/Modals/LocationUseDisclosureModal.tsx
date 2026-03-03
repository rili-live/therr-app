import React from 'react';
import { Text } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';
import { IAreaType } from 'therr-react/types';

export type IAcknowledgementType = 'accept' | 'deny' | 'close';

interface ILocationUseDisclosureModal {
    areaType?: IAreaType;
    isVisible: boolean;
    onRequestClose: any;
    translate: Function;
    onSelect: (type: IAcknowledgementType, areaType?: IAreaType) => any;
    themeButtons: {
        styles: any;
    }
    themeDisclosure: {
        styles: any;
    }
}

export default ({
    areaType,
    isVisible,
    onRequestClose,
    translate,
    onSelect,
    themeDisclosure,
}: ILocationUseDisclosureModal) => {
    return (
        <Portal>
            <Dialog
                visible={isVisible}
                onDismiss={onRequestClose}
                style={themeDisclosure.styles.container}
            >
                <Dialog.Title style={themeDisclosure.styles.header}>
                    {translate('permissions.locationGps.header')}
                </Dialog.Title>
                <Dialog.Content>
                    <Text style={themeDisclosure.styles.text}>{translate('permissions.locationGps.description1')}</Text>
                    <Text style={themeDisclosure.styles.text}>{translate('permissions.locationGps.description2')}</Text>
                </Dialog.Content>
                <Dialog.Actions>
                    <Button
                        mode="text"
                        icon="close"
                        onPress={() => onSelect('close', areaType)}
                    >
                        {translate('permissions.locationGps.close')}
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};
