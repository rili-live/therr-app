import Contacts from 'react-native-contacts';
import analytics from '@react-native-firebase/analytics';
import { UserConnectionsService } from 'therr-react/services';
import { requestOSContactsPermissions } from './requestOSPermissions';

const synceMobileContacts = ({
    storePermissions,
    user,
}) => requestOSContactsPermissions(storePermissions).then((response) => {
    const permissionsDenied = Object.keys(response).some((key) => {
        return response[key] !== 'granted';
    });
    if (!permissionsDenied) {
        analytics().logEvent('phone_contacts_perm_granted', {
            userId: user.details.id,
        }).catch((err) => console.log(err));
        return Contacts.getAllWithoutPhotos().then(contacts => {
            // contacts returned

            const contactsSlimmedDown = contacts.map((contact) => ({
                emailAddresses: contact.emailAddresses.filter((address) => address.label.toLowerCase() !== 'work'),
                phoneNumbers: contact.phoneNumbers.filter((address) => address.label.toLowerCase() === 'mobile'),
                isStarred: contact.isStarred,
            })).filter((c) => c.emailAddresses.length || c.phoneNumbers.length).slice(0, 1000);

            // Used to find people already on the app that the user may know
            UserConnectionsService.findPeopleYouKnow({
                contacts: contactsSlimmedDown,
            }).catch((error) => {
                console.log(error);
            });

            return contacts;
        });
    } else {
        analytics().logEvent('phone_contacts_perm_denied', {
            userId: user.details.id,
        }).catch((err) => console.log(err));

        throw new Error('permissions-denied');
    }
});

export  {
    synceMobileContacts,
};
