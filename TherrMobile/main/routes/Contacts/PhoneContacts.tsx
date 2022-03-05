import React from 'react';
import { FlatList, SafeAreaView, Text, View } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'therr-react/types';
import { UserConnectionsService } from 'therr-react/services';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildFormsStyles } from '../../styles/forms';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import translator from '../../services/translator';
// import CreateConnectionButton from '../../components/CreateConnectionButton';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import RoundInput from '../../components/Input/Round';
import PhoneContactItem from './PhoneContactItem';
import { buttonMenuHeight } from '../../styles/navigation/buttonMenu';
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
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.phoneContacts.headerTitle'),
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
        this.setState({
            searchInputValue: value,
        });
    }

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
        }).finally(() => {
            navigation.goBack();
        });
    }

    handleRefresh = () => {
        console.log('refresh');
    }

    render() {
        const { contactList, searchInputValue } = this.state;
        const { navigation, user } = this.props;

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <FlatList
                        data={contactList}
                        keyExtractor={(item) => String(item.recordID)}
                        renderItem={({ item: contact }) => (
                            <PhoneContactItem
                                key={contact.recordID}
                                contactDetails={contact}
                                onPress={this.onContactPress}
                                theme={this.theme}
                            />
                        )}
                        ListEmptyComponent={() => (
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionDescription}>
                                    {this.translate(
                                        'components.contactsSearch.noPhoneContactsFound'
                                    )}
                                </Text>
                            </View>
                        )}
                        ListHeaderComponent={() => (
                            <RoundInput
                                autoCapitalize="none"
                                containerStyle={{ paddingHorizontal: 10 }}
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
                            />
                        )}
                        stickyHeaderIndices={[0]}
                        // onContentSizeChange={() => connections.length && flatListRef.scrollToOffset({ animated: true, offset: 0 })}
                    />
                </SafeAreaView>
                <Button
                    containerStyle={{
                        position: 'absolute',
                        right: 20,
                        bottom: buttonMenuHeight + 20,
                        borderRadius: 100,
                    }}
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
