import React, { useState } from 'react';
import { Text, Modal, Pressable, View } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import styles from '../../styles/modal/tourModal';
import buttonStyles from '../../styles/buttons';

interface ITouringModal {
    isVisible: boolean;
    onRequestClose: any;
    translate: Function;
}

const ModalButton = ({ title, iconName, onPress, iconRight }) => {
    const iconStyle = iconRight ? { paddingLeft: 7 } : { paddingRight: 7 };
    return (
        <Button
            containerStyle={{ flex: 1 }}
            buttonStyle={[buttonStyles.btnClear, { padding: 10 }]}
            titleStyle={buttonStyles.btnTitleBlack}
            icon={
                <MaterialIcon
                    name={iconName}
                    size={20}
                    style={[buttonStyles.btnIconBlack, iconStyle]}
                />
            }
            iconRight={iconRight}
            raised={true}
            type="clear"
            onPress={onPress}
            title={title}
        />
    );
};

export default ({
    isVisible,
    onRequestClose,
    translate,
}: ITouringModal) => {
    const [tab, setTab] = useState(0);

    return (
        <Modal
            animationType="slide"
            visible={isVisible}
            onRequestClose={onRequestClose}
            transparent={true}
        >
            <Pressable
                onPress={onRequestClose}
                style={styles.overlay}>
                {
                    (tab !== 1 && tab !== 2) &&
                    <Pressable style={styles.container}>
                        <Text style={styles.header}>{translate('modals.touringModal.header1')}</Text>
                        <Text style={styles.text}>{translate('modals.touringModal.createAMoment')}</Text>
                        <View style={{ width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                            <ModalButton
                                iconName="close"
                                title={translate('modals.touringModal.exit')}
                                onPress={onRequestClose}
                                iconRight={false}
                            />
                            <ModalButton
                                iconName="arrow-forward"
                                title={translate('modals.touringModal.next')}
                                onPress={() => setTab(1)}
                                iconRight
                            />
                        </View>
                    </Pressable>
                }
                {
                    (tab === 1) &&
                    <Pressable style={styles.container}>
                        <Text style={styles.header}>{translate('modals.touringModal.header2')}</Text>
                        <Text style={styles.text}>{translate('modals.touringModal.claimYourSpaces')}</Text>
                        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                            <ModalButton
                                iconName="arrow-back"
                                title={translate('modals.touringModal.back')}
                                onPress={() => setTab(0)}
                                iconRight={false}
                            />
                            <ModalButton
                                iconName="arrow-forward"
                                title={translate('modals.touringModal.next')}
                                onPress={() => setTab(2)}
                                iconRight
                            />
                        </View>
                    </Pressable>
                }
                {
                    (tab === 2) &&
                    <Pressable style={styles.container}>
                        <Text style={styles.header}>{translate('modals.touringModal.header2')}</Text>
                        <Text style={styles.text}>{translate('modals.touringModal.exploreTheWorld')}</Text>
                        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                            <ModalButton
                                iconName="arrow-back"
                                title={translate('modals.touringModal.back')}
                                onPress={() => setTab(1)}
                                iconRight={false}
                            />
                            <ModalButton
                                iconName="check"
                                title={translate('modals.touringModal.done')}
                                onPress={onRequestClose}
                                iconRight
                            />
                        </View>
                    </Pressable>
                }
            </Pressable>
        </Modal>
    );
};
