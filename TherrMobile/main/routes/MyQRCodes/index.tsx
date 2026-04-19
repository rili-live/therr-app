import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import QRCode from 'react-native-qrcode-svg';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { MapActions } from 'therr-react/redux/actions';
import { MapsService } from 'therr-react/services';
import { IUserState } from 'therr-react/types';
import BaseStatusBar from '../../components/BaseStatusBar';
import { Image } from '../../components/BaseImage';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import UsersActions from '../../redux/actions/UsersActions';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildUserUrl } from '../../utilities/shareUrls';
import { getUserContentUri, getUserImageUri } from '../../utilities/content';
import { IMyQRCodeDetailParams } from './MyQRCodeDetail';

const PROFILE_QR_PREVIEW_SIZE = 64;

interface IMyQRCodesDispatchProps {
    getUserGroups: Function;
    searchMySpaces: Function;
}

interface IStoreProps extends IMyQRCodesDispatchProps {
    user: IUserState;
}

export interface IMyQRCodesProps extends IStoreProps {
    navigation: any;
}

interface IMyQRCodesState {
    isLoadingSpaces: boolean;
    isLoadingEvents: boolean;
    isLoadingGroups: boolean;
    isRefreshing: boolean;
    spaces: any[];
    events: any[];
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            searchMySpaces: MapActions.searchMySpaces,
            getUserGroups: UsersActions.getUserGroups,
        },
        dispatch
    );

class MyQRCodes extends React.Component<IMyQRCodesProps, IMyQRCodesState> {
    private translate: Function;
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();
    private unsubscribeFocusListener: (() => void) | undefined;

    constructor(props: IMyQRCodesProps) {
        super(props);

        this.state = {
            isLoadingSpaces: true,
            isLoadingEvents: true,
            isLoadingGroups: true,
            isRefreshing: false,
            spaces: [],
            events: [],
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.myQRCodes.headerTitle'),
        });

        this.fetchAll();

        this.unsubscribeFocusListener = navigation.addListener('focus', () => {
            this.fetchAll();
        });
    }

    componentWillUnmount() {
        if (this.unsubscribeFocusListener) {
            this.unsubscribeFocusListener();
        }
    }

    fetchAll = () => {
        this.fetchSpaces();
        this.fetchEvents();
        this.fetchGroups();
    };

    // Fetch errors are swallowed intentionally: this screen is offline-tolerant
    // and falls back to empty/cached state rather than blocking the UI with
    // a toast every time the network hiccups.
    fetchSpaces = () => {
        const { searchMySpaces } = this.props;

        this.setState({ isLoadingSpaces: true });
        return searchMySpaces({
            pageNumber: 1,
            itemsPerPage: 50,
        }).then((data: any) => {
            this.setState({ spaces: data?.results || [] });
        }).catch((err: any) => {
            if (__DEV__) { console.warn('[MyQRCodes] fetchSpaces failed:', err?.message || err); }
            this.setState({ spaces: [] });
        }).finally(() => {
            this.setState({ isLoadingSpaces: false });
        });
    };

    fetchEvents = () => {
        this.setState({ isLoadingEvents: true });
        return MapsService.searchMyEvents({
            pageNumber: 1,
            itemsPerPage: 50,
            order: 'desc',
        }).then((response: any) => {
            this.setState({ events: response?.data?.results || [] });
        }).catch((err: any) => {
            if (__DEV__) { console.warn('[MyQRCodes] fetchEvents failed:', err?.message || err); }
            this.setState({ events: [] });
        }).finally(() => {
            this.setState({ isLoadingEvents: false });
        });
    };

    fetchGroups = () => {
        const { getUserGroups } = this.props;

        this.setState({ isLoadingGroups: true });
        return getUserGroups({ withGroups: true })
            .catch((err: any) => {
                if (__DEV__) { console.warn('[MyQRCodes] fetchGroups failed:', err?.message || err); }
            })
            .finally(() => {
                this.setState({ isLoadingGroups: false });
            });
    };

    handleRefresh = () => {
        this.setState({ isRefreshing: true });
        Promise.allSettled([
            this.fetchSpaces(),
            this.fetchEvents(),
            this.fetchGroups(),
        ]).finally(() => {
            this.setState({ isRefreshing: false });
        });
    };

    goToDetail = (params: IMyQRCodeDetailParams) => {
        this.props.navigation.navigate('MyQRCodeDetail', params);
    };

    renderSectionEmpty = (messageKey: string) => (
        <Text
            style={[
                staticStyles.emptyText,
                { color: this.theme.colors.textGray },
            ]}
        >
            {this.translate(messageKey)}
        </Text>
    );

    renderSectionLoader = () => (
        <View style={staticStyles.sectionLoader}>
            <ActivityIndicator
                size="small"
                color={this.theme.colors.primary3}
            />
        </View>
    );

    renderEntityRow = (
        key: string,
        title: string,
        subtitle: string,
        imageUri: string | undefined,
        onPress: () => void,
    ) => (
        <Pressable
            key={key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={this.translate('pages.myQRCodes.rowAccessibilityLabel', {
                title,
            })}
            style={[
                staticStyles.row,
                {
                    borderBottomColor: this.theme.colors.accentDivider,
                    backgroundColor: this.theme.colors.backgroundWhite,
                },
            ]}
        >
            {imageUri ? (
                <Image
                    source={{ uri: imageUri }}
                    style={staticStyles.rowThumb}
                    height={staticStyles.rowThumb.height}
                    width={staticStyles.rowThumb.width}
                    PlaceholderContent={<ActivityIndicator size="small" />}
                />
            ) : (
                <View
                    style={[
                        staticStyles.rowThumb,
                        staticStyles.rowThumbPlaceholder,
                        { backgroundColor: this.theme.colors.backgroundGray },
                    ]}
                >
                    <MaterialIcon
                        name="qr-code-2"
                        size={28}
                        color={this.theme.colors.textGray}
                    />
                </View>
            )}
            <View style={staticStyles.rowContent}>
                <Text
                    numberOfLines={1}
                    style={[staticStyles.rowTitle, { color: this.theme.colors.textWhite }]}
                >
                    {title}
                </Text>
                {!!subtitle && (
                    <Text
                        numberOfLines={1}
                        style={[staticStyles.rowSubtitle, { color: this.theme.colors.textGray }]}
                    >
                        {subtitle}
                    </Text>
                )}
            </View>
            <MaterialIcon
                name="qr-code-2"
                size={28}
                color={this.theme.colors.primary3}
            />
        </Pressable>
    );

    renderEntitySection = (
        entityType: IMyQRCodeDetailParams['entityType'],
        items: any[],
        isLoading: boolean,
        emptyKey: string,
        mapper: (item: any) => { id: string; title: string; subtitle: string; imageUri?: string },
    ) => {
        if (isLoading && !items.length) {
            return this.renderSectionLoader();
        }
        if (!items.length) {
            return this.renderSectionEmpty(emptyKey);
        }
        return items.map((item) => {
            const { id, title, subtitle, imageUri } = mapper(item);
            return this.renderEntityRow(
                `${entityType}-${id}`,
                title,
                subtitle,
                imageUri,
                () => this.goToDetail({ entityType, entityId: id, title, subtitle, imageUri }),
            );
        });
    };

    mapAreaEntity = (entity: any) => ({
        id: String(entity.id),
        title: entity.notificationMsg || entity.message || '—',
        subtitle: entity.addressReadable || '',
        imageUri: entity.media?.featuredImage
            ? getUserContentUri(entity.media.featuredImage, 150, 150)
            : undefined,
    });

    mapGroupEntity = (group: any) => ({
        id: String(group.id),
        title: group.title || group.name || '—',
        subtitle: group.description || '',
        imageUri: group.media?.featuredImage
            ? getUserContentUri(group.media.featuredImage, 150, 150)
            : undefined,
    });

    renderProfileCard = () => {
        const { user } = this.props;
        const details = user.details || ({} as any);
        const locale = user.settings?.locale || 'en-us';
        const profileUrl = details.id ? buildUserUrl(locale, details.id) : '';
        const avatarUri = getUserImageUri(user, 120);
        const fullName = [details.firstName, details.lastName].filter(Boolean).join(' ').trim()
            || details.userName
            || this.translate('pages.myQRCodes.profileFallbackName');
        const userNameLine = details.userName ? `@${details.userName}` : '';

        return (
            <Pressable
                onPress={() => {
                    if (!details.id) { return; }
                    this.goToDetail({
                        entityType: 'user',
                        entityId: details.id,
                        title: fullName,
                        subtitle: userNameLine,
                        imageUri: avatarUri,
                    });
                }}
                accessibilityRole="button"
                accessibilityLabel={this.translate('pages.myQRCodes.profileAccessibilityLabel')}
                style={[
                    staticStyles.profileCard,
                    {
                        backgroundColor: this.theme.colors.backgroundWhite,
                        borderColor: this.theme.colors.accentDivider,
                    },
                ]}
            >
                <Image
                    source={{ uri: avatarUri }}
                    style={staticStyles.profileAvatar}
                    height={staticStyles.profileAvatar.height}
                    width={staticStyles.profileAvatar.width}
                    PlaceholderContent={<ActivityIndicator size="small" />}
                />
                <View style={staticStyles.profileTextBlock}>
                    <Text
                        numberOfLines={1}
                        style={[staticStyles.profileName, { color: this.theme.colors.textWhite }]}
                    >
                        {fullName}
                    </Text>
                    {!!userNameLine && (
                        <Text
                            numberOfLines={1}
                            style={[staticStyles.profileHandle, { color: this.theme.colors.textGray }]}
                        >
                            {userNameLine}
                        </Text>
                    )}
                    <Text
                        numberOfLines={2}
                        style={[staticStyles.profileHint, { color: this.theme.colors.textGray }]}
                    >
                        {this.translate('pages.myQRCodes.profileCardHint')}
                    </Text>
                </View>
                {/* QR is always dark-on-light regardless of theme: scanners
                    degrade on inverted/low-contrast codes. */}
                <View style={staticStyles.profileQrWrapper}>
                    {profileUrl ? (
                        <QRCode
                            value={profileUrl}
                            size={PROFILE_QR_PREVIEW_SIZE}
                            color="#000000"
                            backgroundColor="#ffffff"
                            ecl="M"
                        />
                    ) : (
                        <MaterialIcon name="qr-code-2" size={PROFILE_QR_PREVIEW_SIZE} color="#000" />
                    )}
                </View>
            </Pressable>
        );
    };

    renderSectionHeader = (labelKey: string) => (
        <View
            style={[
                staticStyles.sectionHeader,
                { borderBottomColor: this.theme.colors.accentDivider },
            ]}
        >
            <Text style={[staticStyles.sectionHeaderText, { color: this.theme.colors.textWhite }]}>
                {this.translate(labelKey)}
            </Text>
        </View>
    );

    render() {
        const { navigation, user } = this.props;
        const { isRefreshing } = this.state;

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <ScrollView
                        contentContainerStyle={staticStyles.scrollContent}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={this.handleRefresh}
                                tintColor={this.theme.colors.primary3}
                            />
                        }
                    >
                        <Text
                            style={[
                                staticStyles.subtitle,
                                { color: this.theme.colors.textGray },
                            ]}
                        >
                            {this.translate('pages.myQRCodes.subtitle')}
                        </Text>

                        {this.renderSectionHeader('pages.myQRCodes.sections.profile')}
                        {this.renderProfileCard()}

                        {this.renderSectionHeader('pages.myQRCodes.sections.spaces')}
                        <View style={staticStyles.sectionBody}>
                            {this.renderEntitySection(
                                'space',
                                this.state.spaces,
                                this.state.isLoadingSpaces,
                                'pages.myQRCodes.emptySpaces',
                                this.mapAreaEntity,
                            )}
                        </View>

                        {this.renderSectionHeader('pages.myQRCodes.sections.events')}
                        <View style={staticStyles.sectionBody}>
                            {this.renderEntitySection(
                                'event',
                                this.state.events,
                                this.state.isLoadingEvents,
                                'pages.myQRCodes.emptyEvents',
                                this.mapAreaEntity,
                            )}
                        </View>

                        {this.renderSectionHeader('pages.myQRCodes.sections.groups')}
                        <View style={staticStyles.sectionBody}>
                            {this.renderEntitySection(
                                'group',
                                Object.values(user.myUserGroups || {}),
                                this.state.isLoadingGroups,
                                'pages.myQRCodes.emptyGroups',
                                this.mapGroupEntity,
                            )}
                        </View>
                    </ScrollView>
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

const staticStyles = StyleSheet.create({
    scrollContent: {
        paddingBottom: 120,
    },
    subtitle: {
        fontSize: 13,
        textAlign: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    sectionHeader: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sectionHeaderText: {
        fontSize: 14,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectionBody: {
        minHeight: 48,
    },
    sectionLoader: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginHorizontal: 12,
        marginVertical: 8,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    profileAvatar: {
        height: 64,
        width: 64,
        borderRadius: 32,
    },
    profileTextBlock: {
        flex: 1,
        marginHorizontal: 12,
    },
    profileName: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    profileHandle: {
        fontSize: 13,
        marginBottom: 4,
    },
    profileHint: {
        fontSize: 11,
    },
    profileQrWrapper: {
        padding: 4,
        backgroundColor: '#ffffff',
        borderRadius: 6,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rowThumb: {
        height: 44,
        width: 44,
        borderRadius: 6,
        marginRight: 12,
    },
    rowThumbPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    rowContent: {
        flex: 1,
        marginRight: 12,
    },
    rowTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    rowSubtitle: {
        fontSize: 12,
        marginTop: 2,
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(MyQRCodes);
