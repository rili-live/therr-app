import React from 'react';
import { Text, Modal, Pressable } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import disclosureStyles from '../../styles/modal/locationDisclosure';
import buttonStyles from '../../styles/buttons';

export type IAcknowledgementType = 'accept' | 'deny' | 'close';

interface ILocationUseDisclosureModal {
    isVisible: boolean;
    onRequestClose: any;
    translate: Function;
    onSelect: (type: IAcknowledgementType) => any
}

const ModalButton = ({ title, iconName, onPress }) => (
    <Button
        containerStyle={{ width: '100%' }}
        buttonStyle={[buttonStyles.btnClear, { padding: 10 }]}
        titleStyle={buttonStyles.btnTitleBlack}
        icon={
            <MaterialIcon
                name={iconName}
                size={20}
                style={[buttonStyles.btnIconBlack, { paddingRight: 7 }]}
            />
        }
        raised={true}
        type="clear"
        onPress={onPress}
        title={title}
    />
);

export default ({
    isVisible,
    onRequestClose,
    translate,
    onSelect,
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
                style={disclosureStyles.overlay}>
                <Pressable style={disclosureStyles.container}>
                    <Text style={disclosureStyles.header}>{translate('permissions.locationGps.header')}</Text>
                    <Text style={disclosureStyles.text}>{translate('permissions.locationGps.description1')}</Text>
                    <Text style={disclosureStyles.text}>{translate('permissions.locationGps.description2')}</Text>
                    {/* <ModalButton
                        iconName="check"
                        title={translate('permissions.locationGps.yes')}
                        onPress={() => onSelect('accept')}
                    /> */}
                    <ModalButton
                        iconName="close"
                        title={translate('permissions.locationGps.close')}
                        onPress={() => onSelect('close')}
                    />
                </Pressable>
            </Pressable>
        </Modal>
    );
};
