import React from 'react';
import { Linking, SectionList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import 'react-native-gesture-handler';
import { Button } from 'react-native-paper';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import { UserConnectionsService } from 'therr-react/services';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import Toast from 'react-native-toast-message';
import { showToast, DURATION } from '../../utilities/toasts';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildFormsStyles } from '../../styles/forms';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import translator from '../../utilities/translator';
import { buildInviteUrl } from '../../utilities/shareUrls';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import RoundInput from '../../components/Input/Round';
import ListEmpty from '../../components/ListEmpty';
import PhoneContactItem from './components/PhoneContactItem';
import spacingStyles from '../../styles/layouts/spacing';
import { IMatchedUser } from '../../utilities/contacts';
import {
    buildMailToUrl,
    buildSmsUrl,
    getContactDisplayName,
    getContactEmail,
    getContactInviteTargetLabel,
    getContactPhoneNumber,
    isContactInvitable,
} from '../../utilities/inviteContacts';

const MAX_BATCH_INVITE = 10;

interface IPhoneContactsDispatchProps {
    createUserConnection: Function;
}

interface IStoreProps extends IPhoneContactsDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IPhoneContactsProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IPhoneContactsState {
    contactsOnApp: any[];
    contactsNotOnApp: any[];
    filteredContactsOnApp: any[];
    filteredContactsNotOnApp: any[];
    searchInputValue: string;
}

const mapStateToProps = (state) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            createUserConnection: UserConnectionsActions.create,
        },
        dispatch
    );

const normalizeContactValue = (value: string): string => {
    return value.replace(/[\s\-()]/g, '').toLowerCase();
};

const contactMatchesUser = (contact: any, matchedUsers: IMatchedUser[]): IMatchedUser | undefined => {
    return matchedUsers.find((mu) => {
        // Match by email
        if (mu.email && contact.emailAddresses?.length) {
            const matchEmail = mu.email.toLowerCase();
            const hasEmailMatch = contact.emailAddresses.some(
                (addr: any) => addr.email?.toLowerCase() === matchEmail,
            );
            if (hasEmailMatch) { return true; }
        }

        // Match by phone
        if (mu.phoneNumber && contact.phoneNumbers?.length) {
            const matchPhone = normalizeContactValue(mu.phoneNumber);
            const hasPhoneMatch = contact.phoneNumbers.some(
                (p: any) => normalizeContactValue(p.number || '').includes(matchPhone)
                    || matchPhone.includes(normalizeContactValue(p.number || '')),
            );
            if (hasPhoneMatch) { return true; }
        }

        return false;
    });
};

class PhoneContacts extends React.Component<IPhoneContactsProps, IPhoneContactsState> {
    private translate: Function;
    private theme = buildStyles();
    private themeButtons = buildButtonsStyles();
    private themeForms = buildFormsStyles();
    private themeMenu = buildMenuStyles();

    constructor(props) {
        super(props);

        const { route } = this.props;
        const { allContacts, matchedUsers = [] } = route.params;

        const onApp: any[] = [];
        const notOnApp: any[] = [];

        allContacts.forEach((contact) => {
            const matchedUser = contactMatchesUser(contact, matchedUsers);
            if (matchedUser) {
                onApp.push({ ...contact, matchedUser });
            } else if (isContactInvitable(contact)) {
                // Contacts with neither a phone number nor an email have nowhere for an
                // invite to go, so listing them only produces a button that cannot work.
                notOnApp.push({ ...contact, isChecked: false, isInvited: false });
            }
        });

        this.state = {
            contactsOnApp: onApp,
            contactsNotOnApp: notOnApp,
            filteredContactsOnApp: onApp,
            filteredContactsNotOnApp: notOnApp,
            searchInputValue: '',
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormsStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.phoneContacts.headerTitle'),
        });
    }

    onContactPress = (contactId) => {
        // Replace the toggled contact rather than mutating it — the same object is
        // referenced by the filtered list, so an in-place edit leaves the two copies
        // sharing state and the checkbox can miss its re-render.
        const modifiedContactList = this.state.contactsNotOnApp.map((contact) => (
            contact.recordID === contactId
                ? { ...contact, isChecked: !contact.isChecked }
                : contact
        ));

        this.setState({
            contactsNotOnApp: modifiedContactList,
        }, () => {
            this.applySearchFilter(this.state.searchInputValue);
        });
    };

    onSearchInputChange = (value: string) => {
        this.setState({
            searchInputValue: value,
        }, () => {
            this.applySearchFilter(value);
        });
    };

    applySearchFilter = (value: string) => {
        const { contactsOnApp, contactsNotOnApp } = this.state;
        const lowerValue = value.toLowerCase();

        const filterFn = (contact) => {
            if (!value) { return true; }
            return getContactDisplayName(contact).toLowerCase().includes(lowerValue)
                || getContactInviteTargetLabel(contact).toLowerCase().includes(lowerValue);
        };

        this.setState({
            filteredContactsOnApp: [...contactsOnApp].filter(filterFn),
            filteredContactsNotOnApp: [...contactsNotOnApp].filter(filterFn),
        });
    };

    /**
     * Resumes the guided profile flow at its phone stage. Verification UI only exists
     * inside that stack, so this is the entry point for every phone-gated action that
     * needs to send the user somewhere rather than just telling them no.
     */
    goToPhoneVerification = () => {
        const { navigation } = this.props;

        Toast.hide();
        navigation.navigate('CreateProfile', { stage: 'phone' });
    };

    onViewUserPress = (contact: any) => {
        const { navigation } = this.props;
        const matchedUser = contact.matchedUser;
        if (!matchedUser) { return; }

        navigation.navigate('ViewUser', {
            userInView: {
                id: matchedUser.id,
            },
        });
    };

    onConnectPress = (contact: any) => {
        const { createUserConnection, user } = this.props;
        const matchedUser = contact.matchedUser;
        if (!matchedUser) { return; }

        createUserConnection({
            requestingUserId: user.details.id,
            requestingUserFirstName: user.details.firstName,
            requestingUserLastName: user.details.lastName,
            requestingUserEmail: user.details.email,
            acceptingUserId: matchedUser.id,
            acceptingUserEmail: matchedUser.email,
            acceptingUserPhoneNumber: matchedUser.phoneNumber,
        }, {
            userName: user?.details?.userName,
        }).then(() => {
            showToast.success({
                text1: this.translate('pages.phoneContacts.alertTitles.connectRequestSent'),
                text2: this.translate('pages.phoneContacts.alertMessages.connectRequestSent'),
            });
        }).catch(() => {
            // Error handled by redux
        });
    };

    onInvitePress = (contact: any) => {
        this.sendInvites([contact]);
    };

    onInviteSelected = () => {
        const selectedContacts = this.state.contactsNotOnApp.filter((c) => c.isChecked);

        if (!selectedContacts.length) {
            showToast.info({
                text1: this.translate('pages.phoneContacts.alertTitles.noContactsSelected'),
                text2: this.translate('pages.phoneContacts.alertMessages.noContactsSelected'),
            });
            return;
        }

        this.sendInvites(selectedContacts);
    };

    /**
     * Single entry point for both the per-row "Invite" button and the batched
     * "Invite Selected" button so the two cannot drift apart again — previously only
     * the batch path registered the invite server-side.
     */
    sendInvites = (contacts: any[]) => {
        const { user } = this.props;

        const invitableContacts = contacts.filter(isContactInvitable);

        if (!invitableContacts.length) {
            showToast.error({
                text1: this.translate('pages.phoneContacts.alertTitles.noContactInfo'),
                text2: this.translate('pages.phoneContacts.alertMessages.noContactInfo'),
            });
            return;
        }

        if (invitableContacts.length > MAX_BATCH_INVITE) {
            showToast.warn({
                text1: this.translate('pages.phoneContacts.alertTitles.tooManySelected'),
                text2: this.translate('pages.phoneContacts.alertMessages.tooManySelected', {
                    count: MAX_BATCH_INVITE,
                }),
            });
        }

        const invitees = invitableContacts.slice(0, MAX_BATCH_INVITE);
        const locale = user.settings?.locale || 'en-us';
        const inviteMessage = this.translate('pages.phoneContacts.inviteMessage', {
            inviteCode: user.details.userName,
            shareUrl: buildInviteUrl(locale, user.details.userName),
        });

        UserConnectionsService.invite({
            requestingUserId: user.details.id,
            requestingUserEmail: user.details.email,
            requestingUserFirstName: user.details.firstName,
            requestingUserLastName: user.details.lastName,
            inviteList: invitees.map((contact) => {
                const normalizedContact: any = {};
                const email = getContactEmail(contact);
                const phoneNumber = getContactPhoneNumber(contact);

                if (email) {
                    normalizedContact.email = email;
                }
                if (phoneNumber) {
                    normalizedContact.phoneNumber = phoneNumber;
                }

                return normalizedContact;
            }),
        }).then(() => {
            showToast.success({
                text1: this.translate('pages.phoneContacts.alertTitles.contactInvitesSent'),
                text2: this.translate('pages.phoneContacts.alertMessages.contactInvitesSent'),
            });
        }).catch((error) => {
            // The gateway gates bulk invites on MOBILE_VERIFIED, so an account that
            // signed up without verifying a phone gets a 403 here. Swallowing it made
            // the button look dead; the SMS composer below still opens either way.
            const isPhoneUnverified = error?.response?.status === 403;

            if (isPhoneUnverified) {
                // The toast used to be the end of the road: it named the problem but the
                // only phone-verification UI lives inside the CreateProfile stack, which
                // nothing outside onboarding linked to. Tapping now resumes that flow at
                // its phone stage, which is the same target the profile checklist uses.
                showToast.error({
                    text1: this.translate('pages.phoneContacts.alertTitles.phoneVerificationRequired'),
                    text2: this.translate('pages.phoneContacts.alertMessages.phoneVerificationRequired'),
                    duration: DURATION.LONG,
                    onPress: this.goToPhoneVerification,
                });
                return;
            }

            showToast.error({
                text1: this.translate('pages.phoneContacts.alertTitles.inviteFailed'),
                text2: this.translate('pages.phoneContacts.alertMessages.inviteFailed'),
            });
        });

        this.markContactsInvited(invitees);
        this.openInviteComposer(invitees, inviteMessage);
    };

    /**
     * Opens the OS composer prefilled with the invite so the user can send a personal
     * message alongside the server-sent invite.
     */
    openInviteComposer = (invitees: any[], inviteMessage: string) => {
        const smsUrl = buildSmsUrl(invitees.map(getContactPhoneNumber), inviteMessage);

        if (smsUrl) {
            Linking.openURL(smsUrl).catch(() => {
                // The server-side invite already went out, so a device with no SMS
                // handler is not a failure worth interrupting the user over.
            });
            return;
        }

        // Email-only selection: a mailto composer only accepts one invite message, so
        // fall back to it just for a single contact. Larger email-only batches are
        // fully covered by the server-side invite.
        if (invitees.length === 1) {
            const mailToUrl = buildMailToUrl(
                getContactEmail(invitees[0]),
                this.translate('pages.phoneContacts.inviteSubject'),
                inviteMessage,
            );

            if (mailToUrl) {
                Linking.openURL(mailToUrl).catch(() => {});
            }
        }
    };

    markContactsInvited = (invitees: any[]) => {
        const invitedIds = new Set(invitees.map((contact) => contact.recordID));
        const modifiedContactList = this.state.contactsNotOnApp.map((contact) => (
            invitedIds.has(contact.recordID)
                ? { ...contact, isChecked: false, isInvited: true }
                : contact
        ));

        this.setState({
            contactsNotOnApp: modifiedContactList,
        }, () => {
            this.applySearchFilter(this.state.searchInputValue);
        });
    };

    handleRefresh = () => {
        // No-op for now
    };

    renderSectionHeader = ({ section }: { section: { title: string; key: string } }) => {
        const selectedCount = this.state.contactsNotOnApp.filter((c) => c.isChecked).length;

        return (
            <View style={{
                backgroundColor: this.theme.colors.primary,
                paddingHorizontal: 16,
                paddingVertical: 10,
            }}>
                <Text style={{
                    color: this.theme.colors.textWhite,
                    fontSize: 16,
                    fontWeight: 'bold',
                }}>{section.title}</Text>
                {section.key === 'notOnApp' && (
                    <Button
                        mode="contained"
                        onPress={this.onInviteSelected}
                        disabled={!selectedCount}
                        style={{ marginTop: 8, alignSelf: 'flex-start' }}
                        labelStyle={{ fontSize: 12 }}
                        compact
                    >
                        {selectedCount
                            ? this.translate('pages.phoneContacts.buttons.inviteSelectedCount', { count: selectedCount })
                            : this.translate('pages.phoneContacts.buttons.inviteSelected')}
                    </Button>
                )}
            </View>
        );
    };

    renderItem = ({ item: contact, section }: { item: any; section: { key: string } }) => {
        if (section.key === 'onApp') {
            return (
                <PhoneContactItem
                    key={contact.recordID}
                    contactDetails={contact}
                    onPress={() => this.onViewUserPress(contact)}
                    onActionPress={() => this.onConnectPress(contact)}
                    theme={this.theme}
                    actionLabel={this.translate('pages.phoneContacts.buttons.connect')}
                />
            );
        }

        return (
            <PhoneContactItem
                key={contact.recordID}
                contactDetails={contact}
                isCheckable
                isActionDisabled={contact.isInvited}
                onPress={this.onContactPress}
                onActionPress={() => this.onInvitePress(contact)}
                theme={this.theme}
                actionLabel={this.translate(
                    contact.isInvited
                        ? 'pages.phoneContacts.buttons.invited'
                        : 'pages.phoneContacts.buttons.invite'
                )}
            />
        );
    };

    renderSectionEmpty = (sectionKey: string) => {
        const messageKey = sectionKey === 'onApp'
            ? 'pages.phoneContacts.empty.onApp'
            : 'pages.phoneContacts.empty.notOnApp';
        return (
            <ListEmpty theme={this.theme} text={this.translate(messageKey)} />
        );
    };

    render() {
        const { filteredContactsOnApp, filteredContactsNotOnApp, searchInputValue } = this.state;
        const { navigation, user } = this.props;

        const sections = [
            {
                key: 'onApp',
                title: this.translate('pages.phoneContacts.sections.onApp'),
                data: filteredContactsOnApp,
            },
            {
                key: 'notOnApp',
                title: this.translate('pages.phoneContacts.sections.notOnApp'),
                data: filteredContactsNotOnApp,
            },
        ];

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView edges={[]} style={this.theme.styles.safeAreaView}>
                    <SectionList
                        sections={sections}
                        extraData={this.state.contactsNotOnApp}
                        keyExtractor={(item) => String(item.recordID)}
                        renderSectionHeader={this.renderSectionHeader}
                        renderItem={this.renderItem}
                        renderSectionFooter={({ section }) => (
                            section.data.length === 0
                                ? this.renderSectionEmpty(section.key)
                                : null
                        )}
                        ListHeaderComponent={
                            <RoundInput
                                autoCapitalize="none"
                                containerStyle={[
                                    spacingStyles.padHorizMd,
                                    spacingStyles.padTopMd,
                                    { backgroundColor: this.theme.colors.primary },
                                ]}
                                placeholder={this.translate(
                                    'forms.groups.searchPlaceholder'
                                )}
                                value={searchInputValue}
                                onChangeText={this.onSearchInputChange}
                                rightIcon={
                                    <FontAwesomeIcon
                                        name="search"
                                        color={this.theme.colors.primary3}
                                        size={22}
                                    />
                                }
                                themeForms={this.themeForms}
                            />
                        }
                        stickySectionHeadersEnabled
                    />
                </SafeAreaView>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(PhoneContacts);
