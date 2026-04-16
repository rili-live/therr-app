import React from 'react';
import {
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Toast from 'react-native-toast-message';
import { MapActions } from 'therr-react/redux/actions';
import { IUserState } from 'therr-react/types';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildLoaderStyles } from '../../styles/loaders';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import LottieLoader from '../../components/LottieLoader';

const staticStyles = StyleSheet.create({
    spaceRowContent: {
        flex: 1,
        marginRight: 8,
    },
    spaceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    spaceRowActions: {
        flexDirection: 'row',
    },
    rewardBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rewardBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    rewardBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    viewButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    editButtonText: {
        fontSize: 12,
        fontWeight: '600',
    },
    viewButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginRight: 6,
        borderRadius: 6,
    },
    editButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
    },
    coinBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    coinBannerLabel: {
        fontSize: 13,
    },
    coinBannerValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#f0ad4e',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 15,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listEmptyContent: {
        flexGrow: 1,
    },
    spaceNameText: {
        fontWeight: 'bold',
        fontSize: 15,
        marginBottom: 2,
    },
    spaceAddressText: {
        fontSize: 12,
        marginBottom: 4,
    },
});

interface IManageSpacesDispatchProps {
    searchMySpaces: Function;
}

interface IStoreProps extends IManageSpacesDispatchProps {
    user: IUserState;
}

export interface IManageSpacesProps extends IStoreProps {
    navigation: any;
}

interface IManageSpacesState {
    spacesInView: any[];
    isLoading: boolean;
    isRefreshing: boolean;
    hasFetchError: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            searchMySpaces: MapActions.searchMySpaces,
        },
        dispatch
    );

class ManageSpaces extends React.PureComponent<IManageSpacesProps, IManageSpacesState> {
    private translate: Function;

    private theme = buildStyles();

    private themeButtons = buildButtonsStyles();

    private themeLoader = buildLoaderStyles();

    private themeMenu = buildMenuStyles();

    private unsubscribeFocusListener;

    constructor(props) {
        super(props);

        this.state = {
            spacesInView: [],
            isLoading: true,
            isRefreshing: false,
            hasFetchError: false,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeLoader = buildLoaderStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.manageSpaces.headerTitle'),
        });

        this.unsubscribeFocusListener = navigation.addListener('focus', () => {
            this.fetchSpaces();
        });
    }

    componentWillUnmount(): void {
        if (this.unsubscribeFocusListener) {
            this.unsubscribeFocusListener();
        }
    }

    fetchSpaces = (isRefresh = false) => {
        const { searchMySpaces } = this.props;

        this.setState(isRefresh ? { isRefreshing: true } : { isLoading: true });

        return searchMySpaces({
            pageNumber: 1,
            itemsPerPage: 50,
        }).then((data) => {
            this.setState({
                spacesInView: data?.results || [],
                hasFetchError: false,
            });
        }).catch(() => {
            this.setState({ hasFetchError: true });
            Toast.show({
                type: 'error',
                text1: this.translate('alertTitles.backendErrorMessage'),
                text2: this.translate('pages.manageSpaces.fetchError'),
            });
        }).finally(() => {
            this.setState({ isLoading: false, isRefreshing: false });
        });
    };

    handleRefresh = () => this.fetchSpaces(true);

    goToViewSpace = (space: any) => {
        const { navigation } = this.props;

        navigation.navigate('ViewSpace', {
            isMySpace: true,
            previousView: 'ManageSpaces',
            spaceDetails: space,
        });
    };

    goToEditSpace = (space: any) => {
        const { navigation } = this.props;

        navigation.navigate('EditSpace', {
            area: space,
            imageDetails: {},
            nearbySpaces: [],
        });
    };

    renderSpaceRow = ({ item: space }: { item: any }) => {
        const hasReward = !!space.featuredIncentiveKey;

        return (
            <View style={[
                staticStyles.spaceRow,
                {
                    borderBottomColor: this.theme.colors.accentDivider,
                    backgroundColor: this.theme.colors.backgroundWhite,
                },
            ]}>
                <View style={staticStyles.spaceRowContent}>
                    <Text
                        style={[staticStyles.spaceNameText, { color: this.theme.colors?.textBlack || '#000' }]}
                        numberOfLines={1}
                    >
                        {space.notificationMsg || '—'}
                    </Text>
                    <Text
                        style={[staticStyles.spaceAddressText, { color: this.theme.colors?.textGray || '#666' }]}
                        numberOfLines={1}
                    >
                        {space.addressReadable || '—'}
                    </Text>
                    <View style={staticStyles.rewardBadgeRow}>
                        <View style={[
                            staticStyles.rewardBadge,
                            { backgroundColor: hasReward ? '#28a745' : '#6c757d' },
                        ]}>
                            <Text style={staticStyles.rewardBadgeText}>
                                {hasReward
                                    ? this.translate('pages.manageSpaces.rewardActive')
                                    : this.translate('pages.manageSpaces.rewardInactive')}
                            </Text>
                        </View>
                    </View>
                </View>
                <View style={staticStyles.spaceRowActions}>
                    <TouchableOpacity
                        onPress={() => this.goToViewSpace(space)}
                        style={[
                            this.themeButtons.styles.btnSmall || {},
                            staticStyles.viewButton,
                            { backgroundColor: this.theme.colors?.primary3 || '#007bff' },
                        ]}
                    >
                        <Text style={staticStyles.viewButtonText}>
                            {this.translate('pages.manageSpaces.buttons.view')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => this.goToEditSpace(space)}
                        style={[
                            staticStyles.editButton,
                            { borderColor: this.theme.colors?.primary3 || '#007bff' },
                        ]}
                    >
                        <Text style={[staticStyles.editButtonText, { color: this.theme.colors?.primary3 || '#007bff' }]}>
                            {this.translate('pages.manageSpaces.buttons.edit')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    renderEmpty = () => {
        const { isLoading, hasFetchError } = this.state;

        if (isLoading) {
            return null;
        }

        const messageKey = hasFetchError
            ? 'pages.manageSpaces.fetchError'
            : 'pages.manageSpaces.noSpacesFound';

        return (
            <View style={staticStyles.emptyContainer}>
                <Text style={[staticStyles.emptyText, { color: this.theme.colors.textGray }]}>
                    {this.translate(messageKey)}
                </Text>
            </View>
        );
    };

    render() {
        const { isLoading, isRefreshing, spacesInView } = this.state;
        const { navigation, user } = this.props;

        const parsedCoins = parseFloat(user.details?.settingsTherrCoinTotal || '0');
        const coinBalance = Number.isFinite(parsedCoins) ? parsedCoins : 0;

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    {/* Coin Balance Banner */}
                    <View style={[
                        staticStyles.coinBanner,
                        {
                            backgroundColor: this.theme.colors.backgroundGray,
                            borderBottomColor: this.theme.colors.accentDivider,
                        },
                    ]}>
                        <Text style={[staticStyles.coinBannerLabel, { color: this.theme.colors.textGray }]}>
                            {this.translate('pages.manageSpaces.coinBalanceLabel')}:{'  '}
                        </Text>
                        <Text style={staticStyles.coinBannerValue}>
                            {coinBalance.toFixed(2)} TherrCoins
                        </Text>
                    </View>

                    {isLoading ? (
                        <View style={staticStyles.loaderContainer}>
                            <LottieLoader id="therr-black-rolling" theme={this.themeLoader} />
                        </View>
                    ) : (
                        <FlatList
                            data={spacesInView}
                            keyExtractor={(item) => String(item.id)}
                            renderItem={this.renderSpaceRow}
                            ListEmptyComponent={this.renderEmpty}
                            contentContainerStyle={spacesInView.length === 0 ? staticStyles.listEmptyContent : undefined}
                            onRefresh={this.handleRefresh}
                            refreshing={isRefreshing}
                        />
                    )}
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

export default connect(mapStateToProps, mapDispatchToProps)(ManageSpaces);
