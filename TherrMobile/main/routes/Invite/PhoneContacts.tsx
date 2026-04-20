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
import { showToast } from '../../utilities/toasts';
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
            } else {
                notOnApp.push(contact);
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
        const { contactsNotOnApp } = this.state;
        const modifiedContactList = [...contactsNotOnApp];
        const idx = modifiedContactList.findIndex((c) => c.recordID === contactId);
        if (idx > -1) {
            modifiedContactList[idx].isChecked = !modifiedContactList[idx].isChecked;
        }

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
            return contact.givenName?.toLowerCase().includes(lowerValue)
                || contact.familyName?.toLowerCase().includes(lowerValue)
                || `${contact.givenName} ${contact.familyName}`.toLowerCase().includes(lowerValue);
        };

        this.setState({
            filteredContactsOnApp: [...contactsOnApp].filter(filterFn),
            filteredContactsNotOnApp: [...contactsNotOnApp].filter(filterFn),
        });
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
        const { user } = this.props;
        const locale = user.settings?.locale || 'en-us';
        const inviteMessage = this.translate('pages.phoneContacts.inviteMessage', {
            inviteCode: user.details.userName,
            shareUrl: buildInviteUrl(locale, user.details.userName),
        });

        const mobileNumber = contact.phoneNumbers?.find((n) => n.label === 'mobile');
        if (mobileNumber) {
            const smsUrl = `sms:${mobileNumber.number}&body=${encodeURIComponent(inviteMessage)}`;
            Linking.openURL(smsUrl).catch(() => {
                // Fallback: try with ? separator (iOS)
                Linking.openURL(`sms:${mobileNumber.number}?body=${encodeURIComponent(inviteMessage)}`).catch(() => {});
            });
        } else if (contact.emailAddresses?.length) {
            const emailUrl = `mailto:${contact.emailAddresses[0].email}?subject=${
                encodeURIComponent(this.translate('pages.phoneContacts.inviteSubject'))
            }&body=${encodeURIComponent(inviteMessage)}`;
            Linking.openURL(emailUrl).catch(() => {});
        }
    };

    onInviteSelected = () => {
        const { user } = this.props;
        const { contactsNotOnApp } = this.state;
        const selectedContacts = contactsNotOnApp
            .filter((c) => c.isChecked)
            .slice(0, MAX_BATCH_INVITE);

        if (!selectedContacts.length) {
            showToast.info({
                text1: this.translate('pages.phoneContacts.alertTitles.noContactsSelected'),
                text2: this.translate('pages.phoneContacts.alertMessages.noContactsSelected'),
            });
            return;
        }

        const locale = user.settings?.locale || 'en-us';
        const inviteMessage = this.translate('pages.phoneContacts.inviteMessage', {
            inviteCode: user.details.userName,
            shareUrl: buildInviteUrl(locale, user.details.userName),
        });

        // Collect phone numbers for batch SMS
        const phoneNumbers = selectedContacts
            .map((c) => {
                const mobile = c.phoneNumbers?.find((n) => n.label === 'mobile');
                return mobile?.number || c.phoneNumbers?.[0]?.number;
            })
            .filter(Boolean);

        if (phoneNumbers.length) {
            const smsUrl = `sms:${phoneNumbers.join(',')}&body=${encodeURIComponent(inviteMessage)}`;
            Linking.openURL(smsUrl).catch(() => {
                Linking.openURL(`sms:${phoneNumbers.join(',')}?body=${encodeURIComponent(inviteMessage)}`).catch(() => {});
            });
        }

        // Also send server-side invites
        const inviteList = selectedContacts.map((phoneContact) => {
            const normalizedContact: any = {};
            if (phoneContact.emailAddresses?.length) {
                normalizedContact.email = phoneContact.emailAddresses[0].email;
            }
            if (phoneContact.phoneNumbers?.length) {
                const mobileNumber = phoneContact.phoneNumbers.find((n) => n.label === 'mobile');
                if (mobileNumber) {
                    normalizedContact.phoneNumber = mobileNumber.number;
                } else {
                    normalizedContact.phoneNumber = phoneContact.phoneNumbers[0].number;
                }
            }
            return normalizedContact;
        });

        UserConnectionsService.invite({
            requestingUserId: user.details.id,
            requestingUserEmail: user.details.email,
            requestingUserFirstName: user.details.firstName,
            requestingUserLastName: user.details.lastName,
            inviteList,
        }).then(() => {
            showToast.success({
                text1: this.translate('pages.phoneContacts.alertTitles.contactInvitesSent'),
                text2: this.translate('pages.phoneContacts.alertMessages.contactInvitesSent'),
            });
        }).catch(() => {
            // Error handled silently
        });
    };

    handleRefresh = () => {
        // No-op for now
    };

    renderSectionHeader = ({ section }: { section: { title: string; key: string } }) => {
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
                        style={{ marginTop: 8, alignSelf: 'flex-start' }}
                        labelStyle={{ fontSize: 12 }}
                        compact
                    >
                        {this.translate('pages.phoneContacts.buttons.inviteSelected')}
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
                onPress={this.onContactPress}
                onActionPress={() => this.onInvitePress(contact)}
                theme={this.theme}
                actionLabel={this.translate('pages.phoneContacts.buttons.invite')}
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
