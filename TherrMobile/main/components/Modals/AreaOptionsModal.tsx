import React from 'react';
import { Modal, Pressable } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { ITherrThemeColors } from '../../styles/themes';
import spacingStyles from '../../styles/layouts/spacing';


export type ISelectionType = 'getDirections' | 'shareALink' | 'like' | 'superLike' | 'dislike' | 'superDislike' | 'report' | 'delete';

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
    onSelect: (type: ISelectionType) => any;
    shouldIncludeShareButton?: boolean;
}

export const ModalButton = ({ title, iconName, onPress, themeButtons }) => (
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
    children,
    isVisible,
    onRequestClose,
    translate,
    onSelect,
    themeButtons,
    themeReactionsModal,
    shouldIncludeShareButton,
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
                                title={translate('modals.contentOptions.buttons.getDirections')}
                                onPress={() => onSelect('getDirections')}
                                themeButtons={themeButtons}
                            />
                            {
                                shouldIncludeShareButton && <ModalButton
                                    iconName="share"
                                    title={translate('modals.contentOptions.buttons.shareALink')}
                                    onPress={() => onSelect('shareALink')}
                                    themeButtons={themeButtons}
                                />
                            }
                            <ModalButton
                                iconName="thumb-up"
                                title={translate('modals.contentOptions.buttons.superLike')}
                                onPress={() => onSelect('superLike')}
                                themeButtons={themeButtons}
                            />
                            <ModalButton
                                iconName="thumb-down"
                                title={translate('modals.contentOptions.buttons.dislike')}
                                onPress={() => onSelect('dislike')}
                                themeButtons={themeButtons}
                            />
                            <ModalButton
                                iconName="thumb-down"
                                title={translate('modals.contentOptions.buttons.superDislike')}
                                onPress={() => onSelect('superDislike')}
                                themeButtons={themeButtons}
                            />
                            <ModalButton
                                iconName="report-problem"
                                title={translate('modals.contentOptions.buttons.report')}
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
