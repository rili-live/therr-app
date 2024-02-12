import React from 'react';
import { Text, Modal, Pressable } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { IAreaType } from 'therr-react/types';
import spacingStyles from '../../styles/layouts/spacing';

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

const ModalButton = ({ title, iconName, onPress, themeButtons }) => (
    <Button
        containerStyle={spacingStyles.fullWidth}
        buttonStyle={[themeButtons.styles.btnClear, spacingStyles.padMd]}
        titleStyle={themeButtons.styles.btnTitleBlack}
        icon={
            <MaterialIcon
                name={iconName}
                size={20}
                style={[themeButtons.styles.btnIconBlack, { paddingRight: 7 }]}
            />
        }
        raised={true}
        type="clear"
        onPress={onPress}
        title={title}
    />
);

export default ({
    areaType,
    isVisible,
    onRequestClose,
    translate,
    onSelect,
    themeButtons,
    themeDisclosure,
}: ILocationUseDisclosureModal) => {
    return (
        <Modal
            animationType="slide"
            visible={isVisible}
            onRequestClose={onRequestClose}
            transparent={true}
        >
            <Pressable
                onPress={onRequestClose}
                style={themeDisclosure.styles.overlay}>
                <Pressable style={themeDisclosure.styles.container}>
                    <Text style={themeDisclosure.styles.header}>{translate('permissions.locationGps.header')}</Text>
                    <Text style={themeDisclosure.styles.text}>{translate('permissions.locationGps.description1')}</Text>
                    <Text style={themeDisclosure.styles.text}>{translate('permissions.locationGps.description2')}</Text>
                    {/* <ModalButton
                        iconName="check"
                        title={translate('permissions.locationGps.yes')}
                        onPress={() => onSelect('accept')}
                    /> */}
                    <ModalButton
                        iconName="close"
                        title={translate('permissions.locationGps.close')}
                        onPress={() => onSelect('close', areaType)}
                        themeButtons={themeButtons}
                    />
                </Pressable>
            </Pressable>
        </Modal>
    );
};
