import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-elements';
import LottieView from 'lottie-react-native';
import UserSearchItem from './UserSearchItem';
import spacingStyles from '../../../styles/layouts/spacing';
import searchLoading from '../../../assets/search-loading.json';
import { synceMobileContacts } from '../../../utilities/contacts';

const PeopleYouMayKnow = ({
    mightKnowUsers,
    getConnectionOrUserDetails,
    getConnectionSubtitle,
    goToViewUser,
    onSendConnectRequest,
    theme,
    themeButtons,
    // themeForms,
    translate,
    user,
}) => {
    const [isSyncing, setSyncing] = useState(false);
    const [hasSynced, setHasSynced] = useState(false);
    const [syncStatus, setSyncStatus] = useState('not-synced');
    const syncContacts = () => {
        // TODO: Store permissions in redux
        const storePermissions = () => {};

        setSyncing(true);

        // TODO: Send a websocket event and return list of discovered 'might know' users
        synceMobileContacts({
            storePermissions,
            user,
        }).then(() => {
            setSyncStatus('sync-success');
        }).catch(() => {
            setSyncStatus('sync-failed');
        }).finally(() => {
            setSyncing(false);
            setHasSynced(true);
        });
    };

    let buttonText = translate('pages.contacts.buttons.syncContacts');
    if (syncStatus === 'sync-success') {
        buttonText = translate('pages.contacts.buttons.syncSuccess');
    } else if (syncStatus === 'sync-failed') {
        buttonText = translate('pages.contacts.buttons.syncFailed');
    }

    return (
        <>
            <Text style={[
                theme.styles.sectionTitleSmallestCenter,
                spacingStyles.marginTopMd,
                spacingStyles.marginLtMd,
            ]}>{translate('pages.contacts.labels.peopleYouMightKnow')}</Text>
            {
                !mightKnowUsers?.length &&
                <>
                    {
                        !isSyncing &&
                        <Text style={[
                            theme.styles.sectionDescriptionNote,
                            spacingStyles.marginBotMd,
                        ]}>
                            {translate('pages.contacts.labels.noContactsFound')}
                        </Text>
                    }
                    <View style={[
                        spacingStyles.marginHorizXlg,
                        spacingStyles.marginBotMd,
                    ]}>
                        {
                            isSyncing ?
                                <LottieView
                                    source={searchLoading}
                                    // resizeMode="cover"
                                    resizeMode="contain"
                                    speed={1}
                                    autoPlay
                                    loop
                                    style={[{top: 0, width: '100%', height: 50}]}
                                /> :
                                <Button
                                    onPress={syncContacts}
                                    containerStyle={themeButtons.styles.buttonPillContainerSquare}
                                    buttonStyle={themeButtons.styles.buttonPill}
                                    titleStyle={themeButtons.styles.buttonPillTitle}
                                    title={buttonText}
                                    disabled={isSyncing || hasSynced}
                                />
                        }
                    </View>
                </>
            }
            {
                mightKnowUsers.map((user) => (
                    <UserSearchItem
                        key={user.id}
                        userDetails={getConnectionOrUserDetails(user)}
                        getUserSubtitle={getConnectionSubtitle}
                        goToViewUser={goToViewUser}
                        onSendConnectRequest={onSendConnectRequest}
                        theme={theme}
                        themeButtons={themeButtons}
                        translate={translate}
                        user={user}
                    />
                ))
            }
            <Text style={[
                theme.styles.sectionTitleSmallestCenter,
                spacingStyles.marginTopMd,
                spacingStyles.marginLtMd,
            ]}>{translate('pages.contacts.labels.allUsers')}</Text>
        </>
    );
};

export default PeopleYouMayKnow;
