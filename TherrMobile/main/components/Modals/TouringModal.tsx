import React, { useState } from 'react';
import { Text, Modal, Pressable, View, GestureResponderEvent } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';
import AnimatedLottieView from 'lottie-react-native';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { IUserState } from 'therr-react/types';
import claimASpace from '../../assets/claim-a-space.json';
import shareAMoment from '../../assets/share-a-moment.json';
import discover from '../../assets/discover.json';
import matchUp from '../../assets/match-up.json';

interface ITouringModal {
    isVisible: boolean;
    onFindFriends: any;
    onRequestClose: any;
    translate: Function;
    themeTour: {
        styles: any;
    };
    user: IUserState;
}

const TouringModal = ({
    isVisible,
    onRequestClose,
    onFindFriends,
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
        logEvent(getAnalytics(),'find_friends_from_tour', {
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
        >
            <Pressable
                onPress={onClose}
                style={themeTour.styles.overlay}>
                {
                    (tab !== 1 && tab !== 2 && tab !== 3 && tab !== 4) &&
                    <Pressable style={themeTour.styles.container}>
                        <Text style={themeTour.styles.header}>{translate('modals.touringModal.header5')}</Text>
                        <Text style={themeTour.styles.text}>{translate('modals.touringModal.matchUp')}</Text>
                        <AnimatedLottieView
                            source={matchUp}
                            resizeMode="contain"
                            speed={0.5}
                            autoPlay={true}
                            loop
                            style={themeTour.styles.graphic}
                        />
                        <Text style={themeTour.styles.text}>{translate('modals.touringModal.matchUp2')}</Text>
                        <View style={themeTour.styles.actionsContainer}>
                            <PaperButton
                                mode="contained"
                                onPress={() => setTab(1)}
                                icon="arrow-right"
                                contentStyle={themeTour.styles.actionButtonContentRight}
                                style={themeTour.styles.actionButton}
                            >
                                {translate('modals.touringModal.next')}
                            </PaperButton>
                        </View>
                    </Pressable>
                }
                {
                    (tab === 1) &&
                    <Pressable style={themeTour.styles.container}>
                        <Text style={themeTour.styles.header}>{translate('modals.touringModal.header3')}</Text>
                        <Text style={themeTour.styles.text}>{translate('modals.touringModal.exploreTheWorld')}</Text>
                        <AnimatedLottieView
                            source={claimASpace}
                            resizeMode="contain"
                            speed={1}
                            autoPlay={false}
                            loop
                            style={themeTour.styles.graphic}
                        />
                        <Text style={themeTour.styles.text}>{translate('modals.touringModal.exploreTheWorld2')}</Text>
                        <View style={themeTour.styles.actionsContainer}>
                            <PaperButton
                                mode="outlined"
                                onPress={() => setTab(0)}
                                icon="arrow-left"
                                style={themeTour.styles.actionButton}
                            >
                                {translate('modals.touringModal.back')}
                            </PaperButton>
                            <PaperButton
                                mode="contained"
                                onPress={() => setTab(2)}
                                icon="arrow-right"
                                contentStyle={themeTour.styles.actionButtonContentRight}
                                style={themeTour.styles.actionButton}
                            >
                                {translate('modals.touringModal.next')}
                            </PaperButton>
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
                            resizeMode="contain"
                            speed={1}
                            autoPlay={false}
                            loop
                            style={themeTour.styles.graphic}
                        />
                        <Text style={themeTour.styles.text}>{translate('modals.touringModal.createAMoment2')}</Text>
                        <View style={themeTour.styles.actionsContainer}>
                            <PaperButton
                                mode="outlined"
                                onPress={() => setTab(1)}
                                icon="arrow-left"
                                style={themeTour.styles.actionButton}
                            >
                                {translate('modals.touringModal.back')}
                            </PaperButton>
                            <PaperButton
                                mode="contained"
                                onPress={() => setTab(3)}
                                icon="arrow-right"
                                contentStyle={themeTour.styles.actionButtonContentRight}
                                style={themeTour.styles.actionButton}
                            >
                                {translate('modals.touringModal.next')}
                            </PaperButton>
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
                            resizeMode="contain"
                            speed={1}
                            autoPlay={false}
                            loop
                            style={themeTour.styles.graphic}
                        />
                        <Text style={themeTour.styles.text}>{translate('modals.touringModal.claimYourSpaces2')}</Text>
                        <View style={themeTour.styles.actionsContainer}>
                            <PaperButton
                                mode="outlined"
                                onPress={() => setTab(2)}
                                icon="arrow-left"
                                style={themeTour.styles.actionButton}
                            >
                                {translate('modals.touringModal.back')}
                            </PaperButton>
                            <PaperButton
                                mode="contained"
                                onPress={() => setTab(4)}
                                icon="arrow-right"
                                contentStyle={themeTour.styles.actionButtonContentRight}
                                style={themeTour.styles.actionButton}
                            >
                                {translate('modals.touringModal.next')}
                            </PaperButton>
                        </View>
                    </Pressable>
                }
                {
                    (tab === 4) &&
                    <Pressable style={themeTour.styles.container}>
                        <Text style={themeTour.styles.header}>{translate('modals.touringModal.header4')}</Text>
                        <Text style={themeTour.styles.text}>{translate('modals.touringModal.findFriends')}</Text>
                        <View style={themeTour.styles.buttonContainer}>
                            <PaperButton
                                mode="contained"
                                onPress={onFindFriendsPress}
                                icon="account-multiple"
                                contentStyle={themeTour.styles.actionButtonContentRight}
                                style={themeTour.styles.buttonPrimary}
                            >
                                {translate('forms.createConnection.buttons.findFriends')}
                            </PaperButton>
                        </View>
                        <Text style={themeTour.styles.text}>{translate('modals.touringModal.findFriends2')}</Text>
                        <View style={themeTour.styles.actionsContainer}>
                            <PaperButton
                                mode="outlined"
                                onPress={() => setTab(3)}
                                icon="arrow-left"
                                style={themeTour.styles.actionButton}
                            >
                                {translate('modals.touringModal.back')}
                            </PaperButton>
                            <PaperButton
                                mode="contained"
                                onPress={onClose}
                                icon="check"
                                contentStyle={themeTour.styles.actionButtonContentRight}
                                style={themeTour.styles.actionButton}
                                disabled={isDoneDisabled}
                            >
                                {translate('modals.touringModal.done')}
                            </PaperButton>
                        </View>
                    </Pressable>
                }
            </Pressable>
        </Modal>
    );
};

export default React.memo(TouringModal);
