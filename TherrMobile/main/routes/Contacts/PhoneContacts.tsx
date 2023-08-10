import React from 'react';
import { FlatList, SafeAreaView } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'therr-react/types';
import { UserConnectionsService } from 'therr-react/services';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import Toast from 'react-native-toast-message';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildFormsStyles } from '../../styles/forms';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import translator from '../../services/translator';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import RoundInput from '../../components/Input/Round';
import ListEmpty from '../../components/ListEmpty';
import PhoneContactItem from './components/PhoneContactItem';
import { Button } from 'react-native-elements';

interface IPhoneContactsDispatchProps {
    logout: Function;
}

interface IStoreProps extends IPhoneContactsDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IPhoneContactsProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IPhoneContactsState {
    contactList: any[];
    filteredContactList: any[];
    searchInputValue: string;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {},
        dispatch
    );

class PhoneContacts extends React.Component<IPhoneContactsProps, IPhoneContactsState> {
    private translate: Function;
    private theme = buildStyles();
    private themeButtons = buildButtonsStyles();
    private themeForms = buildFormsStyles();
    private themeMenu = buildMenuStyles();

    constructor(props) {
        super(props);

        const { route } = this.props;
        const { allContacts } = route.params;

        this.state = {
            contactList: allContacts,
            filteredContactList: allContacts,
            searchInputValue: '',
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormsStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { contactList } = this.state;
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.phoneContacts.headerTitle'),
        });

        const contactsSlimmedDown = contactList.map((contact) => ({
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
    }

    onContactPress = (contactId) => {
        const { contactList } = this.state;
        const modifiedContactList = [...contactList];
        const idx = modifiedContactList.findIndex((c) => c.recordID === contactId);
        if (idx > -1) {
            modifiedContactList[idx].isChecked = !modifiedContactList[idx].isChecked;
        }

        this.setState({
            contactList: modifiedContactList,
        });
    };

    onSearchInputChange = (value: string) => {
        const { contactList } = this.state;
        const filtered =  [...contactList].filter((contact) => {
            return contact.givenName?.toLowerCase().includes(value.toLowerCase())
                || contact.familyName?.toLowerCase().includes(value.toLowerCase())
                || `${contact.givenName} ${contact.familyName}`.toLowerCase().includes(value.toLowerCase());
        });

        this.setState({
            searchInputValue: value,
            filteredContactList: filtered,
        });
    };

    onSubmit = () => {
        const { contactList } = this.state;
        const { navigation, user } = this.props;
        const selectedContacts = contactList
            .filter((c => c.isChecked))
            .map((phoneContact) => {
                const normalizedContact: any = {};
                if (phoneContact.emailAddresses?.length) {
                    normalizedContact.email = phoneContact.emailAddresses[0].email;
                }
                if (phoneContact.phoneNumbers?.length) {
                    const mobileNumber = phoneContact.phoneNumbers.find(n => n.label === 'mobile');
                    if (mobileNumber) {
                        normalizedContact.phoneNumber = mobileNumber.number;
                    } else {
                        normalizedContact.phoneNumber = phoneContact.phoneNumbers[0].number;
                    }
                }

                return normalizedContact;
            });

        return UserConnectionsService.invite({
            requestingUserId: user.details.id,
            requestingUserEmail: user.details.email,
            requestingUserFirstName: user.details.firstName,
            requestingUserLastName: user.details.lastName,
            inviteList: selectedContacts,
        }).then(() => {
            Toast.show({
                type: 'successBig',
                text1: this.translate('pages.phoneContacts.alertTitles.contactInvitesSent'),
                text2: this.translate('pages.phoneContacts.alertMessages.contactInvitesSent'),
                visibilityTime: 3000,
            });
        }).finally(() => {
            navigation.goBack();
        });
    };

    handleRefresh = () => {
        console.log('refresh');
    };

    render() {
        const { filteredContactList, searchInputValue } = this.state;
        const { navigation, user } = this.props;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <FlatList
                        data={filteredContactList}
                        keyExtractor={(item) => String(item.recordID)}
                        renderItem={({ item: contact }) => (
                            <PhoneContactItem
                                key={contact.recordID}
                                contactDetails={contact}
                                onPress={this.onContactPress}
                                theme={this.theme}
                            />
                        )}
                        ListEmptyComponent={<ListEmpty theme={this.theme} text={this.translate(
                            'components.contactsSearch.noContactsFound'
                        )} />}
                        ListHeaderComponent={<RoundInput
                            autoCapitalize="none"
                            containerStyle={{ paddingHorizontal: 10, backgroundColor: this.theme.colors.primary, paddingTop: 10 }}
                            placeholder={this.translate(
                                'forms.hostedChat.searchPlaceholder'
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
                        />}
                        stickyHeaderIndices={[0]}
                        // onContentSizeChange={() => contactList.length && flatListRef.scrollToOffset({ animated: true, offset: 0 })}
                    />
                </SafeAreaView>
                <Button
                    containerStyle={this.themeButtons.styles.buttonFloatBottomRightContainer}
                    buttonStyle={this.themeButtons.styles.btnLargeWithText}
                    titleStyle={this.themeButtons.styles.btnMediumTitleRight}
                    icon={
                        <FontAwesomeIcon
                            name="paper-plane"
                            size={22}
                            style={[this.themeButtons.styles.btnIcon]}
                        />
                    }
                    raised={true}
                    title={this.translate('menus.connections.buttons.invite')}
                    onPress={this.onSubmit}
                />
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
