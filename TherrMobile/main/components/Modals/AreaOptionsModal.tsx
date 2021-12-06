import React from 'react';
import { Modal, Pressable } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import areaOptionsStyles from '../../styles/modal/momentOptions';
import buttonStyles from '../../styles/buttons';

export type ISelectionType = 'like' | 'dislike' | 'report';

interface IAreaOptionsModal {
    isVisible: boolean;
    onRequestClose: any;
    translate: Function;
    onSelect: (type: ISelectionType) => any
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
}: IAreaOptionsModal) => {
    return (
        <Modal
            animationType="slide"
            visible={isVisible}
            onRequestClose={onRequestClose}
            transparent={true}
        >
            <Pressable
                onPress={onRequestClose}
                style={areaOptionsStyles.overlay}>
                <Pressable style={areaOptionsStyles.container}>
                    <ModalButton
                        iconName="thumb-up"
                        title={translate('modals.areaOptions.buttons.like')}
                        onPress={() => onSelect('like')}
                    />
                    <ModalButton
                        iconName="thumb-down"
                        title={translate('modals.areaOptions.buttons.dislike')}
                        onPress={() => onSelect('dislike')}
                    />
                    <ModalButton
                        iconName="report-problem"
                        title={translate('modals.areaOptions.buttons.report')}
                        onPress={() => onSelect('report')}
                    />
                </Pressable>
            </Pressable>
        </Modal>
    );
};
