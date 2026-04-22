import Contacts from 'react-native-contacts';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { UserConnectionsService } from 'therr-react/services';
import { requestOSContactsPermissions } from './requestOSPermissions';

interface IMatchedUser {
    id: string;
    email?: string;
    phoneNumber?: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
}

interface ISyncResult {
    contacts: Contacts.Contact[];
    matchedUsers: IMatchedUser[];
}

const synceMobileContacts = ({
    storePermissions,
    user,
}): Promise<ISyncResult> => requestOSContactsPermissions(storePermissions).then((response) => {
    const permissionsDenied = Object.keys(response).some((key) => {
        return response[key] !== 'granted';
    });
    if (!permissionsDenied) {
        logEvent(getAnalytics(),'phone_contacts_perm_granted', {
            userId: user.details.id,
        }).catch((err) => console.log(err));
        return Contacts.getAllWithoutPhotos().then(contacts => {
            // contacts returned

            const contactsFiltered = contacts.map((contact) => ({
                emailAddresses: contact.emailAddresses.filter((address) => address.label.toLowerCase() !== 'work'),
                phoneNumbers: contact.phoneNumbers.filter((address) => address.label.toLowerCase() === 'mobile'),
                isStarred: contact.isStarred,
            })).filter((c) => c.emailAddresses.length || c.phoneNumbers.length);

            const promises: Promise<any>[] = [];
            let pointer = 0;

            // Request in batches of 500 to prevent too much data in payload
            while (pointer < Math.min(contactsFiltered.length, 10000)) {
                promises.push(UserConnectionsService.findPeopleYouKnow({
                    contacts: contactsFiltered.slice(pointer, pointer + 500),
                }));

                pointer += 500;
            }

            // Collect matched users from all batches
            return Promise.all(promises).then((responses) => {
                const allMatchedUsers: IMatchedUser[] = [];
                responses.forEach((resp) => {
                    if (resp?.data?.matchedUsers) {
                        allMatchedUsers.push(...resp.data.matchedUsers);
                    }
                });

                return {
                    contacts,
                    matchedUsers: allMatchedUsers,
                };
            }).catch((error) => {
                console.log(error);
                return {
                    contacts,
                    matchedUsers: [],
                };
            });
        });
    } else {
        logEvent(getAnalytics(),'phone_contacts_perm_denied', {
            userId: user.details.id,
        }).catch((err) => console.log(err));

        throw new Error('permissions-denied');
    }
});

export  {
    synceMobileContacts,
};

export type { IMatchedUser, ISyncResult };
