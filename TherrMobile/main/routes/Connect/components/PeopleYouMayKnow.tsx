import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../../components/BaseButton';
import LottieView from 'lottie-react-native';
import UserSearchItem from './UserSearchItem';
import spacingStyles from '../../../styles/layouts/spacing';
import searchLoading from '../../../assets/search-loading.json';
import { synceMobileContacts } from '../../../utilities/contacts';
import { getProfileCompletionFlags, markContactsSynced } from '../../../utilities/profileCompletion';

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
    // `null` while the persisted flag is still loading, so the full sync prompt
    // never flashes for users who already synced on a previous session.
    const [hasSyncedPreviously, setHasSyncedPreviously] = useState<boolean | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const userId = user?.details?.id;

    useEffect(() => {
        let isMounted = true;

        getProfileCompletionFlags(userId).then((flags) => {
            if (isMounted) {
                setHasSyncedPreviously(!!flags.hasSyncedContacts);
            }
        }).catch(() => {
            if (isMounted) {
                setHasSyncedPreviously(false);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [userId]);

    const syncContacts = () => {
        // TODO: Store permissions in redux
        const storePermissions = () => {};

        setSyncing(true);
        // Keep the prompt open for the rest of this session so the user sees
        // the success/failure result; it collapses again on the next visit.
        setIsExpanded(true);

        // TODO: Send a websocket event and return list of discovered 'might know' users
        synceMobileContacts({
            storePermissions,
            user,
        }).then(() => {
            setSyncStatus('sync-success');
            setHasSyncedPreviously(true);
            return markContactsSynced(userId);
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

    // Once contacts have been synced the prompt is noise: collapse it to a
    // single re-sync link the user can expand on demand.
    const isCollapsed = hasSyncedPreviously !== false && !isExpanded;
    const shouldRenderSyncPrompt = !mightKnowUsers?.length && hasSyncedPreviously !== null;

    return (
        <>
            <Text style={[
                theme.styles.sectionTitleSmallestCenter,
                spacingStyles.marginTopMd,
                spacingStyles.marginLtMd,
            ]}>{translate('pages.contacts.labels.peopleYouMightKnow')}</Text>
            {
                shouldRenderSyncPrompt &&
                <>
                    {
                        !isSyncing && !isCollapsed &&
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
                            isSyncing &&
                            <LottieView
                                source={searchLoading}
                                // resizeMode="cover"
                                resizeMode="contain"
                                speed={1}
                                autoPlay
                                loop
                                style={[{top: 0, width: '100%', height: 50}]}
                            />
                        }
                        {
                            !isSyncing && isCollapsed &&
                            <Pressable
                                onPress={() => setIsExpanded(true)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={translate('pages.contacts.buttons.resyncContacts')}
                            >
                                <Text style={[theme.styles.sectionDescriptionNote, theme.styles.link]}>
                                    {translate('pages.contacts.buttons.resyncContacts')}
                                </Text>
                            </Pressable>
                        }
                        {
                            !isSyncing && !isCollapsed &&
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
                mightKnowUsers.map((mightKnowUser) => (
                    <UserSearchItem
                        key={mightKnowUser.id}
                        userDetails={getConnectionOrUserDetails(mightKnowUser)}
                        getUserSubtitle={getConnectionSubtitle}
                        goToViewUser={goToViewUser}
                        onSendConnectRequest={onSendConnectRequest}
                        theme={theme}
                        themeButtons={themeButtons}
                        translate={translate}
                        user={mightKnowUser}
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
