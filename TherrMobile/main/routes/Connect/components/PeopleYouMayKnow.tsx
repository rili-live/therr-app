import React from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-elements';
import UserSearchItem from './UserSearchItem';
import spacingStyles from '../../../styles/layouts/spacing';


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
}) => {
    // TODO: Implement synceMobileContacts
    const syncContacts = () => console.log('Sync Contacts');

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
                    <Text style={[
                        theme.styles.sectionDescriptionNote,
                        spacingStyles.marginBotMd,
                    ]}>
                        {translate('pages.contacts.labels.noContactsFound')}
                    </Text>
                    <View style={[
                        spacingStyles.marginHorizXlg,
                        spacingStyles.marginBotMd,
                    ]}>
                        <Button
                            onPress={syncContacts}
                            containerStyle={themeButtons.styles.buttonPillContainerSquare}
                            buttonStyle={themeButtons.styles.buttonPill}
                            titleStyle={themeButtons.styles.buttonPillTitle}
                            title={translate('pages.contacts.buttons.syncContacts')}
                        />
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
