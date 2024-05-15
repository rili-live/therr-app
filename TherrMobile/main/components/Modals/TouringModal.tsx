import React, { useState } from 'react';
import { Text, Modal, Pressable, View, GestureResponderEvent } from 'react-native';
import { Button } from 'react-native-elements';
import AnimatedLottieView from 'lottie-react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import analytics from '@react-native-firebase/analytics';
import { IUserState } from 'therr-react/types';
import claimASpace from '../../assets/claim-a-space.json';
import shareAMoment from '../../assets/share-a-moment.json';
import discover from '../../assets/discover.json';
import matchUp from '../../assets/match-up.json';
import ModalButton from './ModalButton';
import spacingStyles from '../../styles/layouts/spacing';

interface ITouringModal {
    isVisible: boolean;
    onFindFriends: any;
    onRequestClose: any;
    translate: Function;
    themeButtons: {
        styles: any;
    };
    themeTour: {
        styles: any;
    };
    user: IUserState;
}

const TouringModal = ({
    isVisible,
    onRequestClose,
    onFindFriends,
    themeButtons,
    themeTour,
    translate,
    user,
}: ITouringModal) => {
    const [tab, setTab] = useState(0);
    const [isDoneDisabled, setDoneDisabled] = useState(true);
    const onClose = (e?: GestureResponderEvent) => {
        e?.stopPropagation();
        // This is necessary to prevent odd bug where advancing is necessary before closing. Otherwise modal gets stuck open
        if (tab > 0) {
            setTab(0);
            onRequestClose();
        }
    };
    const onFindFriendsPress = (e?: GestureResponderEvent) => {
        onClose(e);
        analytics().logEvent('find_friends_from_tour', {
            userId: user.details.id,
        }).catch((err) => console.log(err));
        onFindFriends();
    };

    if (tab === 4) {
        // Prevents user from rapid clicking and missing the find friends button
        if (isDoneDisabled) {
            setTimeout(() => {
                setDoneDisabled(false);
            }, 1000);
        }
    }

    return (
        <Modal
            animationType="fade"
            visible={isVisible}
            onRequestClose={onClose}
            transparent={true}
            // style={{
            //     zIndex: 1000,
            // }}
        >
            <Pressable
                onPress={onClose}
                style={themeTour.styles.overlay}>
                {
                    (tab !== 1 && tab !== 2 && tab !== 3 && tab !== 4) &&
                    <Pressable style={themeTour.styles.container}>
                        <Text style={themeTour.styles.header}>{translate('modals.touringModal.header5')}</Text>
                        <Text style={themeTour.styles.text}>{translate('modals.touringModal.matchUp')}</Text>
                        {/* <Ionicons
                            name="bonfire"
                            size={75}
                            style={themeButtons.styles.btnIcon}
                        /> */}
                        <AnimatedLottieView
                            source={matchUp}
                            // resizeMode="cover"
                            resizeMode="contain"
                            speed={0.5}
                            autoPlay={true}
                            loop
                            style={themeTour.styles.graphic}
                        />
                        <Text style={[themeTour.styles.text, spacingStyles.marginBotMd]}>{translate('modals.touringModal.matchUp2')}</Text>
                        <View style={themeTour.styles.actionsContainer}>
                            <ModalButton
                                iconName="arrow-forward"
                                title={translate('modals.touringModal.next')}
                                onPress={() => setTab(1)}
                                iconRight
                                themeButtons={themeButtons}
                            />
                        </View>
                    </Pressable>
                }
                {
                    (tab == 1) &&
                    <Pressable style={themeTour.styles.container}>
                        <Text style={themeTour.styles.header}>{translate('modals.touringModal.header3')}</Text>
                        <Text style={themeTour.styles.text}>{translate('modals.touringModal.exploreTheWorld')}</Text>
                        <AnimatedLottieView
                            source={claimASpace}
                            // resizeMode="cover"
                            resizeMode="contain"
                            speed={1}
                            autoPlay={false}
                            loop
                            style={themeTour.styles.graphic}
                        />
                        <Text style={[themeTour.styles.text, spacingStyles.marginBotMd]}>{translate('modals.touringModal.exploreTheWorld2')}</Text>
                        <View style={themeTour.styles.actionsContainer}>
                            <ModalButton
                                iconName="arrow-back"
                                title={translate('modals.touringModal.back')}
                                onPress={() => setTab(0)}
                                iconRight={false}
                                themeButtons={themeButtons}
                            />
                            <ModalButton
                                iconName="arrow-forward"
                                title={translate('modals.touringModal.next')}
                                onPress={() => setTab(2)}
                                iconRight
                                themeButtons={themeButtons}
                            />
                        </View>
                    </Pressable>
                }
                {
                    (tab === 2) &&
                    <Pressable style={themeTour.styles.container}>
                        <Text style={themeTour.styles.header}>{translate('modals.touringModal.header2')}</Text>
                        <Text style={themeTour.styles.text}>{translate('modals.touringModal.createAMoment')}</Text>
                        <AnimatedLottieView
                            source={shareAMoment}
                            // resizeMode="cover"
                            resizeMode="contain"
                            speed={1}
                            autoPlay={false}
                            loop
                            style={themeTour.styles.graphic}
                        />
                        <Text style={[themeTour.styles.text, spacingStyles.marginBotMd]}>{translate('modals.touringModal.createAMoment2')}</Text>
                        <View style={themeTour.styles.actionsContainer}>
                            <ModalButton
                                iconName="arrow-back"
                                title={translate('modals.touringModal.back')}
                                onPress={() => setTab(1)}
                                iconRight={false}
                                themeButtons={themeButtons}
                            />
                            <ModalButton
                                iconName="arrow-forward"
                                title={translate('modals.touringModal.next')}
                                onPress={() => setTab(3)}
                                iconRight
                                themeButtons={themeButtons}
                            />
                        </View>
                    </Pressable>
                }
                {
                    (tab === 3) &&
                    <Pressable style={themeTour.styles.container}>
                        <Text style={themeTour.styles.header}>{translate('modals.touringModal.header1')}</Text>
                        <Text style={themeTour.styles.text}>{translate('modals.touringModal.claimYourSpaces')}</Text>
                        <AnimatedLottieView
                            source={discover}
                            // resizeMode="cover"
                            resizeMode="contain"
                            speed={1}
                            autoPlay={false}
                            loop
                            style={themeTour.styles.graphic}
                        />
                        <Text style={[themeTour.styles.text, spacingStyles.marginBotMd]}>{translate('modals.touringModal.claimYourSpaces2')}</Text>
                        <View style={themeTour.styles.actionsContainer}>
                            <ModalButton
                                iconName="arrow-back"
                                title={translate('modals.touringModal.back')}
                                onPress={() => setTab(2)}
                                iconRight={false}
                                themeButtons={themeButtons}
                            />
                            <ModalButton
                                iconName="arrow-forward"
                                title={translate('modals.touringModal.next')}
                                onPress={() => setTab(4)}
                                iconRight
                                themeButtons={themeButtons}
                            />
                        </View>
                    </Pressable>
                }
                {
                    (tab === 4) &&
                    <Pressable style={themeTour.styles.container}>
                        <Text style={themeTour.styles.header}>{translate('modals.touringModal.header4')}</Text>
                        <Text style={themeTour.styles.text}>{translate('modals.touringModal.findFriends')}</Text>
                        <View style={themeTour.styles.buttonContainer}>
                            <Button
                                buttonStyle={themeTour.styles.buttonPrimary}
                                titleStyle={themeTour.styles.buttonTitle}
                                title={translate(
                                    'forms.createConnection.buttons.findFriends'
                                )}
                                onPress={onFindFriendsPress}
                                raised={false}
                                icon={
                                    <MaterialIcon
                                        style={themeTour.styles.buttonIconStyle}
                                        name="people"
                                        size={24}
                                    />
                                }
                                iconRight
                            />
                        </View>
                        <Text style={[themeTour.styles.text, spacingStyles.marginBotMd]}>{translate('modals.touringModal.findFriends2')}</Text>
                        <View style={themeTour.styles.actionsContainer}>
                            <ModalButton
                                iconName="arrow-back"
                                title={translate('modals.touringModal.back')}
                                onPress={() => setTab(3)}
                                iconRight={false}
                                themeButtons={themeButtons}
                            />
                            <ModalButton
                                iconName="check"
                                title={translate('modals.touringModal.done')}
                                onPress={onClose}
                                iconRight
                                themeButtons={themeButtons}
                                disabled={isDoneDisabled}
                            />
                        </View>
                    </Pressable>
                }
            </Pressable>
        </Modal>
    );
};

export default React.memo(TouringModal);
