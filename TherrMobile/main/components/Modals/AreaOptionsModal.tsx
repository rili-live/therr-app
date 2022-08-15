import React from 'react';
import { Modal, Pressable } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { ITherrThemeColors } from '../../styles/themes';

export type ISelectionType = 'getDirections' | 'like' | 'superLike' | 'dislike' | 'superDislike' | 'report' | 'delete';

interface IAreaOptionsModal {
    children?: React.ReactNode,
    isVisible: boolean;
    onRequestClose: any;
    translate: Function;
    themeReactionsModal: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeButtons: {
        colors: ITherrThemeColors;
        styles: any;
    };
    onSelect: (type: ISelectionType) => any
}

export const ModalButton = ({ title, iconName, onPress, themeButtons }) => (
    <Button
        containerStyle={{ width: '100%' }}
        buttonStyle={[themeButtons.styles.btnClear, { padding: 10 }]}
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
    children,
    isVisible,
    onRequestClose,
    translate,
    onSelect,
    themeButtons,
    themeReactionsModal,
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
                style={themeReactionsModal.styles.overlay}>
                <Pressable style={themeReactionsModal.styles.container}>
                    {
                        children ||
                        <>
                            <ModalButton
                                iconName="directions"
                                title={translate('modals.areaOptions.buttons.getDirections')}
                                onPress={() => onSelect('getDirections')}
                                themeButtons={themeButtons}
                            />
                            <ModalButton
                                iconName="thumb-up"
                                title={translate('modals.areaOptions.buttons.superLike')}
                                onPress={() => onSelect('superLike')}
                                themeButtons={themeButtons}
                            />
                            <ModalButton
                                iconName="thumb-down"
                                title={translate('modals.areaOptions.buttons.dislike')}
                                onPress={() => onSelect('dislike')}
                                themeButtons={themeButtons}
                            />
                            <ModalButton
                                iconName="thumb-down"
                                title={translate('modals.areaOptions.buttons.superDislike')}
                                onPress={() => onSelect('superDislike')}
                                themeButtons={themeButtons}
                            />
                            <ModalButton
                                iconName="report-problem"
                                title={translate('modals.areaOptions.buttons.report')}
                                onPress={() => onSelect('report')}
                                themeButtons={themeButtons}
                            />
                        </>
                    }
                </Pressable>
            </Pressable>
        </Modal>
    );
};
