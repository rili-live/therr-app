import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, Divider, FAB, Text } from 'react-native-paper';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions, MapActions } from 'therr-react/redux/actions';
import { IMapState, IUserState } from 'therr-react/types';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import translator from '../../utilities/translator';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import {
    getInitialAuthorFilters,
    getInitialCategoryFilters,
    getInitialVisibilityFilters,
} from '../../utilities/getInitialFilters';

const fabStyle = { borderRadius: 100 };

const renderRedoIcon = (props: { size: number; color: string }) => (
    <FontAwesome5Icon name="redo-alt" size={props.size} color={props.color} />
);

const renderCheckIcon = (props: { size: number; color: string }) => (
    <FontAwesome5Icon name="check" size={props.size} color={props.color} />
);

interface IMapFilteredSearchDispatchProps {
    setMapFilters: Function;
}

interface IStoreProps extends IMapFilteredSearchDispatchProps {
    map: IMapState;
    user: IUserState;
}

// Regular component props
export interface IMapFilteredSearchProps extends IStoreProps {
    navigation: any;
}

interface IMapFilteredSearchState {
    isLoading: boolean;
    hasChanges: boolean;
    authorFilters: { title: string; name: string; isChecked?: boolean }[],
    categoryFilters: { title: string; name: string; isChecked?: boolean }[],
    visibilityFilters: { title: string; name: string; isChecked?: boolean }[],
}

const mapStateToProps = (state: any) => ({
    map: state.map,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            setMapFilters: MapActions.setMapFilters,
            updateActiveMomentsStream: ContentActions.updateActiveMomentsStream,
        },
        dispatch
    );

class MapFilteredSearch extends React.Component<IMapFilteredSearchProps, IMapFilteredSearchState> {
    private initialAuthorFilters;
    private initialCategoryFilters;
    private initialVisibilityFilters;
    private translate: Function;
    private theme = buildStyles();
    private themeButtons = buildButtonStyles();
    private themeForms = buildFormStyles();
    private themeMenu = buildMenuStyles();

    constructor(props) {
        super(props);

        this.translate = (key: string, params: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
        this.initialAuthorFilters = getInitialAuthorFilters(this.translate);
        this.initialCategoryFilters = getInitialCategoryFilters(this.translate);
        this.initialVisibilityFilters = getInitialVisibilityFilters(this.translate);
        const filtersArePopulated = props.map.filtersAuthor?.length && props.map.filtersCategory?.length && props.map.filtersVisibility?.length;

        this.state = {
            isLoading: true,
            hasChanges: false,
            authorFilters: filtersArePopulated
                ? JSON.parse(JSON.stringify(props.map.filtersAuthor))
                : this.initialAuthorFilters.map(x => ({ ...x, isChecked: true})),
            categoryFilters: filtersArePopulated
                ? JSON.parse(JSON.stringify(props.map.filtersCategory))
                : this.initialCategoryFilters.map(x => ({ ...x, isChecked: true})),
            visibilityFilters: filtersArePopulated
                ? JSON.parse(JSON.stringify(props.map.filtersVisibility))
                : this.initialVisibilityFilters.map(x => ({ ...x, isChecked: true})),
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.mapFilteredSearch.headerTitle'),
        });
    }

    handleApplyFilters = (shouldNavigate = false) => {
        const { authorFilters, categoryFilters, visibilityFilters } = this.state;
        const { setMapFilters } = this.props;

        setMapFilters({
            filtersAuthor: authorFilters,
            filtersCategory: categoryFilters,
            filtersVisibility: visibilityFilters,
        });

        if (shouldNavigate) {
            const { navigation } = this.props;
            navigation.goBack();
        }
    };

    handleResetFilters = (shouldNavigate = false) => {
        this.setState({
            authorFilters: this.initialAuthorFilters.map(x => ({ ...x, isChecked: true})),
            categoryFilters: this.initialCategoryFilters.map(x => ({ ...x, isChecked: true})),
            visibilityFilters: this.initialVisibilityFilters.map(x => ({ ...x, isChecked: true})),
        }, this.handleApplyFilters);
        if (shouldNavigate) {
            const { navigation } = this.props;
            navigation.goBack();
        }
    };

    isSelectAll = (title: string) => {
        return title === this.translate('pages.mapFilteredSearch.labels.selectAll') || title === this.translate('pages.mapFilteredSearch.labels.unSelectAll');
    };

    onRefresh = () => {
        console.log('Refresh');
    };

    onChipPress = (filterGroup: 'authorFilters' | 'categoryFilters' | 'visibilityFilters', index: number, isSelectAll: boolean = false) => {
        let modifiedGroup = [...this.state[filterGroup].map(x => ({ ...x }))];
        modifiedGroup[index].isChecked = !modifiedGroup[index].isChecked;
        if (isSelectAll) {
            modifiedGroup = modifiedGroup.map(x => ({ ...x, isChecked: modifiedGroup[index].isChecked}));
        } else {
            // Select All chip
            modifiedGroup[0].isChecked = modifiedGroup.every((item, idx) => {
                if (idx === 0) { return true; }
                return item.isChecked;
            });
        }

        if (modifiedGroup[0].isChecked) {
            modifiedGroup[0].title = this.translate('pages.mapFilteredSearch.labels.unSelectAll');
        } else {
            modifiedGroup[0].title = this.translate('pages.mapFilteredSearch.labels.selectAll');
        }

        // Make sure one of public or private is always checked
        if (!modifiedGroup[index].isChecked) {
            if (modifiedGroup[index].title === this.translate('pages.mapFilteredSearch.labels.public')) {
                const privateBoxIndex = modifiedGroup.findIndex((box) => box.title === this.translate('pages.mapFilteredSearch.labels.private'));
                modifiedGroup[privateBoxIndex].isChecked = true;
            } else if (modifiedGroup[index].title === this.translate('pages.mapFilteredSearch.labels.private')) {
                const publicBoxIndex = modifiedGroup.findIndex((box) => box.title === this.translate('pages.mapFilteredSearch.labels.public'));
                modifiedGroup[publicBoxIndex].isChecked = true;
            }
        }

        // Make sure one of me or NOT me is always checked
        if (!modifiedGroup[index].isChecked) {
            if (modifiedGroup[index].title === this.translate('pages.mapFilteredSearch.labels.me')) {
                const notMeBoxIndex = modifiedGroup.findIndex((box) => box.title === this.translate('pages.mapFilteredSearch.labels.notMe'));
                modifiedGroup[notMeBoxIndex].isChecked = true;
            } else if (modifiedGroup[index].title === this.translate('pages.mapFilteredSearch.labels.notMe')) {
                const meBoxIndex = modifiedGroup.findIndex((box) => box.title === this.translate('pages.mapFilteredSearch.labels.me'));
                modifiedGroup[meBoxIndex].isChecked = true;
            }
        }

        this.setState({
            [filterGroup]: modifiedGroup,
        } as any);
    };

    renderFilterSection = (
        title: string,
        filterGroup: 'authorFilters' | 'categoryFilters' | 'visibilityFilters',
        filters: { title: string; name: string; isChecked?: boolean }[],
    ) => {
        const brandColor = this.theme.colors.brandingBlueGreen;
        const selectAllFilter = filters[0];
        const individualFilters = filters.slice(1);

        return (
            <View style={localStyles.section}>
                <Text
                    variant="titleMedium"
                    style={[this.theme.styles.sectionTitle, localStyles.sectionHeader]}
                >
                    {title}
                </Text>

                {/* Select All / Deselect All */}
                {selectAllFilter && (
                    <Chip
                        mode={selectAllFilter.isChecked ? 'flat' : 'outlined'}
                        selected={selectAllFilter.isChecked}
                        style={[
                            localStyles.selectAllChip,
                            selectAllFilter.isChecked
                                ? { backgroundColor: brandColor }
                                : { backgroundColor: this.theme.colors.backgroundWhite },
                        ]}
                        textStyle={[
                            selectAllFilter.isChecked
                                ? this.themeForms.styles.buttonPillTitleInvert
                                : this.themeForms.styles.buttonPillTitle,
                            localStyles.selectAllChipText,
                        ]}
                        selectedColor={this.theme.colors.brandingWhite}
                        onPress={() => this.onChipPress(filterGroup, 0, true)}
                    >
                        {selectAllFilter.title}
                    </Chip>
                )}

                {/* Individual filter chips */}
                <View style={localStyles.chipsContainer}>
                    {individualFilters.map((item, index) => (
                        <Chip
                            key={item.name}
                            compact
                            mode={item.isChecked ? 'flat' : 'outlined'}
                            selected={item.isChecked}
                            selectedColor={this.theme.colors.brandingWhite}
                            style={[
                                localStyles.chip,
                                item.isChecked
                                    ? { backgroundColor: brandColor }
                                    : { backgroundColor: this.theme.colors.backgroundWhite },
                            ]}
                            textStyle={
                                item.isChecked
                                    ? this.themeForms.styles.buttonPillTitleInvert
                                    : this.themeForms.styles.buttonPillTitle
                            }
                            onPress={() => this.onChipPress(filterGroup, index + 1, false)}
                        >
                            {item.title}
                        </Chip>
                    ))}
                </View>
            </View>
        );
    };

    render() {
        const { navigation, user } = this.props;
        const { authorFilters, categoryFilters, visibilityFilters } = this.state;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView edges={[]} style={this.theme.styles.safeAreaView}>
                    <ScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        style={this.theme.styles.scrollViewFull}
                    >
                        <View style={[this.theme.styles.body, localStyles.container]}>
                            {/* Visibility Filters (moved to top) */}
                            {this.renderFilterSection(
                                this.translate('pages.mapFilteredSearch.h2.visibilityFilters'),
                                'visibilityFilters',
                                visibilityFilters,
                            )}

                            <Divider style={localStyles.divider} />

                            {/* Author Filters */}
                            {this.renderFilterSection(
                                this.translate('pages.mapFilteredSearch.h2.authorFilters'),
                                'authorFilters',
                                authorFilters,
                            )}

                            <Divider style={localStyles.divider} />

                            {/* Category Filters */}
                            {this.renderFilterSection(
                                this.translate('pages.mapFilteredSearch.h2.categoryFilters'),
                                'categoryFilters',
                                categoryFilters,
                            )}
                        </View>
                    </ScrollView>
                </SafeAreaView>
                <View style={this.themeButtons.styles.resetFilters}>
                    <FAB
                        icon={renderRedoIcon}
                        style={fabStyle}
                        variant="secondary"
                        size="small"
                        label={this.translate('menus.filterActions.resetFilters')}
                        onPress={() => this.handleResetFilters(true)}
                    />
                </View>
                <View style={this.themeButtons.styles.applyFilters}>
                    <FAB
                        icon={renderCheckIcon}
                        style={fabStyle}
                        variant="secondary"
                        size="small"
                        label={this.translate('menus.filterActions.applyFilters')}
                        onPress={() => this.handleApplyFilters(true)}
                    />
                </View>
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.onRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

const localStyles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 120,
    },
    section: {
        marginBottom: 8,
    },
    sectionHeader: {
        marginBottom: 12,
    },
    divider: {
        marginBottom: 20,
    },
    selectAllChip: {
        borderRadius: 20,
        marginBottom: 16,
        justifyContent: 'center',
    },
    selectAllChipText: {
        fontSize: 15,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        borderRadius: 20,
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(MapFilteredSearch);
