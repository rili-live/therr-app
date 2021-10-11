import React from 'react';
import { Modal, Pressable } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import momentOptionsStyles from '../../styles/modal/momentOptions';
import buttonStyles from '../../styles/buttons';

export type ISelectionType = 'like' | 'dislike' | 'report';

interface IMomentOptionsModal {
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
}: IMomentOptionsModal) => {
    return (
        <Modal
            animationType="slide"
            visible={isVisible}
            onRequestClose={onRequestClose}
            transparent={true}
        >
            <Pressable
                onPress={onRequestClose}
                style={momentOptionsStyles.overlay}>
                <Pressable style={momentOptionsStyles.container}>
                    <ModalButton
                        iconName="thumb-up"
                        title={translate('modals.momentOptions.buttons.like')}
                        onPress={() => onSelect('like')}
                    />
                    <ModalButton
                        iconName="thumb-down"
                        title={translate('modals.momentOptions.buttons.dislike')}
                        onPress={() => onSelect('dislike')}
                    />
                    <ModalButton
                        iconName="report-problem"
                        title={translate('modals.momentOptions.buttons.report')}
                        onPress={() => onSelect('report')}
                    />
                </Pressable>
            </Pressable>
        </Modal>
    );
};
