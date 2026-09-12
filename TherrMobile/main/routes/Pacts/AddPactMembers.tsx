import React from 'react';
import {
    View, Text, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import { HabitActions } from 'therr-react/redux/actions';
import { IUserState } from 'therr-react/types';
import translator from '../../utilities/translator';
import { Button } from '../../components/BaseButton';
import { Avatar } from '../../components/BaseAvatar';
import { getUserImageUri } from '../../utilities/content';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import { buttonMenuHeight } from '../../styles/navigation/buttonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';

// Server caps a single add at this many; keep the client in step so the button disables before
// a request the API would reject.
const MAX_ADD_AT_ONCE = 5;

interface IConnectionDetails {
    id: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
    media?: any;
}

interface IDispatchProps {
    addPactMembers: Function;
    getPactDetails: Function;
}

interface IStoreProps extends IDispatchProps {
    user: IUserState;
    userConnections: any;
}

export interface IAddPactMembersProps extends IStoreProps {
    navigation: any;
    // `any` (not a strict `{ params: { pactId } }`) so the connected component stays assignable to
    // React Navigation's ScreenComponentType — the same reason CreatePactInvite types it loosely.
    route: any;
}

interface IAddPactMembersState {
    selectedIds: string[];
    isSubmitting: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    addPactMembers: HabitActions.addPactMembers,
    getPactDetails: HabitActions.getPactDetails,
}, dispatch);

/**
 * The other user in a connection record. Mirrors the wizard's `resolvePartnerDetails`: a
 * connection carries both users, so pick the one that is not the current user.
 */
const resolvePartnerDetails = (connection: any, currentUserId: string): IConnectionDetails => {
    if (connection?.users) {
        return connection.users.find((u: any) => u.id !== currentUserId) || connection.users[0] || {};
    }
    return connection;
};

const partnerName = (details: IConnectionDetails, fallback: string): string => {
    const full = `${details.firstName || ''} ${details.lastName || ''}`.trim();
    return full || details.userName || fallback;
};

/**
 * Add people to an existing pact. Deliberately a small, dedicated screen rather than a detour
 * through the growth-critical create-pact wizard: the habit goal is already fixed (it is the
 * pact's), so all this needs is a multi-select over the user's connections and one call.
 */
export class AddPactMembers extends React.Component<IAddPactMembersProps, IAddPactMembersState> {
    private translate: (key: string, params?: any) => string;
    private theme = buildStyles();
    private themeButtons = buildButtonStyles();
    private themeHabits = buildHabitStyles();

    constructor(props: IAddPactMembersProps) {
        super(props);

        this.state = {
            selectedIds: [],
            isSubmitting: false,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeHabits = buildHabitStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) => translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.translate('pages.pacts.addMembersTitle'),
        });
    }

    getFriends = (): IConnectionDetails[] => {
        const { user, userConnections, route } = this.props;
        const currentUserId = user.details?.id || '';
        const connections = (userConnections?.activeConnections || userConnections?.connections || []) as any[];
        // Passed by PactDetail: anyone already active or invited, whom the server would drop from
        // the request anyway. Absent when reached some other way, in which case nothing is hidden.
        const existingMemberIds = new Set<string>(route?.params?.existingMemberIds || []);

        const byId: { [id: string]: IConnectionDetails } = {};
        const friends: IConnectionDetails[] = [];
        connections.forEach((c: any) => {
            const partner = resolvePartnerDetails(c, currentUserId);
            if (partner?.id && partner.id !== currentUserId && !byId[partner.id] && !existingMemberIds.has(partner.id)) {
                byId[partner.id] = partner;
                friends.push(partner);
            }
        });
        return friends;
    };

    toggleSelected = (id: string) => {
        this.setState((prev) => {
            if (prev.selectedIds.includes(id)) {
                return { selectedIds: prev.selectedIds.filter((s) => s !== id) } as IAddPactMembersState;
            }
            if (prev.selectedIds.length >= MAX_ADD_AT_ONCE) {
                return prev;
            }
            return { selectedIds: [...prev.selectedIds, id] } as IAddPactMembersState;
        });
    };

    handleSubmit = () => {
        const { addPactMembers, getPactDetails, navigation, route } = this.props;
        const { pactId } = route.params;
        const { selectedIds } = this.state;

        if (!selectedIds.length) {
            return;
        }

        this.setState({ isSubmitting: true });

        addPactMembers(pactId, selectedIds)
            .then(() => {
                Toast.show({
                    type: 'success',
                    text1: this.translate('pages.pacts.addMembersSuccessTitle'),
                    text2: this.translate('pages.pacts.addMembersSuccessMessage', { count: selectedIds.length }),
                    visibilityTime: 2500,
                });
                // Refresh the pact the user is returning to so the new pending invites show.
                Promise.resolve(getPactDetails(pactId)).catch(() => undefined);
                navigation.goBack();
            })
            .catch((error: any) => {
                const apiMessage = error?.statusCode && typeof error?.message === 'string'
                    ? error.message
                    : '';
                Toast.show({
                    type: 'error',
                    text1: this.translate('pages.pacts.errorTitle'),
                    text2: apiMessage || this.translate('pages.pacts.addMembersError'),
                    visibilityTime: 3000,
                });
            })
            .finally(() => {
                this.setState({ isSubmitting: false });
            });
    };

    renderFriendRow = (friend: IConnectionDetails, index: number) => {
        const { selectedIds } = this.state;
        const isSelected = selectedIds.includes(friend.id);
        const name = partnerName(friend, this.translate('pages.pacts.partnerFallback'));

        return (
            <Pressable
                key={friend.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={name}
                onPress={() => this.toggleSelected(friend.id)}
                style={({ pressed }) => [
                    this.themeHabits.styles.pactMemberRow,
                    index > 0 && this.themeHabits.styles.pactMemberRowDivided,
                    { paddingHorizontal: 16, alignItems: 'center' },
                    pressed && this.themeHabits.styles.pactPressedSurface,
                ]}
            >
                <Avatar
                    title={(name[0] || '?').toUpperCase()}
                    rounded
                    size="small"
                    source={{ uri: getUserImageUri({ details: { id: friend.id, media: friend.media } }, 100) }}
                />
                <View style={this.themeHabits.styles.pactMemberDetails}>
                    <Text style={this.themeHabits.styles.pactMemberName}>{name}</Text>
                </View>
                <MaterialIcon
                    name={isSelected ? 'check-box' : 'check-box-outline-blank'}
                    size={24}
                    color={isSelected ? this.themeHabits.colors.primary3 : this.themeHabits.colors.textGray}
                />
            </Pressable>
        );
    };

    render() {
        const { user } = this.props;
        const { selectedIds, isSubmitting } = this.state;
        const friends = this.getFriends();

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                <SafeAreaView
                    edges={[]}
                    style={[this.theme.styles.safeAreaView, this.themeHabits.styles.dashboardContainer]}
                >
                    <ScrollView contentContainerStyle={{ paddingBottom: buttonMenuHeight + 96 }}>
                        <Text style={[this.themeHabits.styles.dashboardSubtitle, { paddingHorizontal: 20, marginTop: 12 }]}>
                            {this.translate('pages.pacts.addMembersSubtitle')}
                        </Text>
                        <Text style={[this.themeHabits.styles.streakMilestoneText, { paddingHorizontal: 20, marginTop: 8 }]}>
                            {this.translate('pages.pacts.wizard.multiSelectCounter', { count: selectedIds.length })}
                        </Text>

                        {friends.length > 0
                            ? friends.map((f, i) => this.renderFriendRow(f, i))
                            : (
                                <View style={[this.themeHabits.styles.emptyStateContainer, { paddingTop: 24 }]}>
                                    <Text style={this.themeHabits.styles.emptyStateEmoji}>{'🤝'}</Text>
                                    <Text style={this.themeHabits.styles.emptyStateTitle}>
                                        {this.translate('pages.pacts.addMembersEmpty')}
                                    </Text>
                                </View>
                            )}
                    </ScrollView>

                    <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                        {isSubmitting
                            ? <ActivityIndicator size="large" color={this.theme.colors.primary3} />
                            : (
                                <Button
                                    buttonStyle={this.themeButtons.styles.btnLargeWithText}
                                    titleStyle={this.themeButtons.styles.btnLargeTitle}
                                    title={this.translate('pages.pacts.addMembersCta', { count: selectedIds.length })}
                                    onPress={this.handleSubmit}
                                    disabled={!selectedIds.length || isSubmitting}
                                />
                            )}
                    </View>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(AddPactMembers);
