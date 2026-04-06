import React from 'react';
import {
    FlatList,
    SafeAreaView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MapActions } from 'therr-react/redux/actions';
import { IUserState } from 'therr-react/types';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildLoaderStyles } from '../../styles/loaders';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import LottieLoader from '../../components/LottieLoader';

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

    private themeForms = buildFormStyles();

    private themeLoader = buildLoaderStyles();

    private themeMenu = buildMenuStyles();

    private unsubscribeFocusListener;

    constructor(props) {
        super(props);

        this.state = {
            spacesInView: [],
            isLoading: true,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
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

        this.fetchSpaces();

        this.unsubscribeFocusListener = navigation.addListener('focus', () => {
            this.fetchSpaces();
        });
    }

    componentWillUnmount(): void {
        if (this.unsubscribeFocusListener) {
            this.unsubscribeFocusListener();
        }
    }

    fetchSpaces = () => {
        const { searchMySpaces } = this.props;

        this.setState({ isLoading: true });

        searchMySpaces({
            pageNumber: 1,
            itemsPerPage: 50,
        }).then((data) => {
            this.setState({
                spacesInView: data?.results || [],
            });
        }).catch((err) => {
            console.log('ManageSpaces fetchSpaces error:', err);
        }).finally(() => {
            this.setState({ isLoading: false });
        });
    };

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
                this.themeForms.styles.areaContainer || {},
                {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: this.theme.colors?.accentDivider || '#eee',
                    backgroundColor: this.theme.colors?.backgroundWhite || '#fff',
                },
            ]}>
                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                        style={{
                            fontWeight: 'bold',
                            fontSize: 15,
                            color: this.theme.colors?.textBlack || '#000',
                            marginBottom: 2,
                        }}
                        numberOfLines={1}
                    >
                        {space.notificationMsg || '—'}
                    </Text>
                    <Text
                        style={{
                            fontSize: 12,
                            color: this.theme.colors?.textGray || '#666',
                            marginBottom: 4,
                        }}
                        numberOfLines={1}
                    >
                        {space.addressReadable || '—'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 10,
                            backgroundColor: hasReward ? '#28a745' : '#6c757d',
                        }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
                                {hasReward
                                    ? this.translate('pages.manageSpaces.rewardActive')
                                    : this.translate('pages.manageSpaces.rewardInactive')}
                            </Text>
                        </View>
                    </View>
                </View>
                <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity
                        onPress={() => this.goToViewSpace(space)}
                        style={[
                            this.themeButtons.styles.btnSmall || {},
                            {
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                marginRight: 6,
                                borderRadius: 6,
                                backgroundColor: this.theme.colors?.primary3 || '#007bff',
                            },
                        ]}
                    >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                            {this.translate('pages.manageSpaces.buttons.view')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => this.goToEditSpace(space)}
                        style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: this.theme.colors?.primary3 || '#007bff',
                        }}
                    >
                        <Text style={{ color: this.theme.colors?.primary3 || '#007bff', fontSize: 12, fontWeight: '600' }}>
                            {this.translate('pages.manageSpaces.buttons.edit')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    render() {
        const { isLoading, spacesInView } = this.state;
        const { navigation, user } = this.props;

        const coinBalance = parseFloat(user.details?.settingsTherrCoinTotal || '0');

        return (
            <>
                <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    {/* Coin Balance Banner */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        backgroundColor: this.theme.colors?.backgroundGray || '#f8f9fa',
                        borderBottomWidth: 1,
                        borderBottomColor: this.theme.colors?.accentDivider || '#dee2e6',
                    }}>
                        <Text style={{ fontSize: 13, color: this.theme.colors?.textGray || '#666' }}>
                            {this.translate('pages.manageSpaces.coinBalanceLabel')}:{'  '}
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#f0ad4e' }}>
                            {coinBalance.toFixed(2)} TherrCoins
                        </Text>
                    </View>

                    {isLoading && (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <LottieLoader id="therr-black-rolling" style={this.themeLoader.styles.loader} />
                        </View>
                    )}

                    {!isLoading && spacesInView.length === 0 && (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
                            <Text style={{
                                textAlign: 'center',
                                color: this.theme.colors?.textGray || '#666',
                                fontSize: 15,
                            }}>
                                {this.translate('pages.manageSpaces.noSpacesFound')}
                            </Text>
                        </View>
                    )}

                    {!isLoading && spacesInView.length > 0 && (
                        <FlatList
                            data={spacesInView}
                            keyExtractor={(item) => item.id}
                            renderItem={this.renderSpaceRow}
                            onRefresh={this.fetchSpaces}
                            refreshing={isLoading}
                        />
                    )}
                </SafeAreaView>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.fetchSpaces}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ManageSpaces);
