import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button, Chip, Divider, SegmentedButtons, Text } from 'react-native-paper';
import { ContentActions, MapActions } from 'therr-react/redux/actions';
import { IContentState, IMapState as IMapReduxState, IUserState, IUserConnectionsState } from 'therr-react/types';
import { buildStyles } from '../../styles';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import translator from '../../services/translator';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import { getInitialCategoryFilters } from '../../utilities/getInitialFilters';

interface IAdvancedSearchDispatchProps {
    setActiveMomentsFilters: Function;
    setMapFilters: Function;
    updateActiveMomentsStream: Function;
}

interface IStoreProps extends IAdvancedSearchDispatchProps {
    content: IContentState;
    map: IMapReduxState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

export interface IAdvancedSearchProps extends IStoreProps {
    navigation: any;
}

type CategoryFilter = { title: string; name: string; isChecked?: boolean };

const mapStateToProps = (state: any) => ({
    content: state.content,
    map: state.map,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            setActiveMomentsFilters: ContentActions.setActiveMomentsFilters,
            setMapFilters: MapActions.setMapFilters,
            updateActiveMomentsStream: ContentActions.updateActiveMomentsStream,
        },
        dispatch
    );

const AdvancedSearch = ({
    content,
    map,
    navigation,
    user,
    setActiveMomentsFilters,
    setMapFilters,
    updateActiveMomentsStream,
}: IAdvancedSearchProps) => {
    const translate = useCallback(
        (key: string, params?: any) => translator('en-us', key, params),
        []
    );

    const initialCategoryFilters = useRef(getInitialCategoryFilters(translate, true));
    const theme = buildStyles(user.settings?.mobileThemeName);
    const themeForms = buildFormStyles(user.settings?.mobileThemeName);
    const themeMenu = buildMenuStyles(user.settings?.mobileThemeName);
    const isFirstRender = useRef(true);
    const activeAreasFiltersRef = useRef(content.activeAreasFilters);

    const [categoryFilters, setCategoryFilters] = useState<CategoryFilter[]>(() =>
        map.filtersCategory?.length
            ? JSON.parse(JSON.stringify(map.filtersCategory))
            : initialCategoryFilters.current.map((x: CategoryFilter) => ({ ...x, isChecked: true }))
    );

    // Keep ref up to date so the nav listener always reads the latest value
    useEffect(() => {
        activeAreasFiltersRef.current = content.activeAreasFilters;
    }, [content.activeAreasFilters]);

    useEffect(() => {
        navigation.setOptions({
            title: translate('pages.advancedSearch.headerTitle'),
        });

        const unsubscribeNavListener = navigation.addListener('beforeRemove', () => {
            updateActiveMomentsStream({
                withMedia: true,
                withUser: true,
                offset: 0,
                ...activeAreasFiltersRef.current,
            });
        });

        return () => {
            unsubscribeNavListener();
        };
    }, [navigation, translate, updateActiveMomentsStream]);

    // Sync category filter changes to Redux after state updates
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        setMapFilters({ filtersCategory: categoryFilters });
    }, [categoryFilters, setMapFilters]);

    const handleResetFilters = useCallback(() => {
        setCategoryFilters(
            initialCategoryFilters.current.map((x: CategoryFilter) => ({ ...x, isChecked: true }))
        );
    }, []);

    const handleCategoryChipPress = useCallback((index: number, isSelectAll: boolean = false) => {
        setCategoryFilters((prev: CategoryFilter[]) => {
            const updated = prev.map((x: CategoryFilter) => ({ ...x }));
            updated[index] = { ...updated[index], isChecked: !updated[index].isChecked };

            if (isSelectAll) {
                const newChecked = updated[index].isChecked;
                return updated.map((x: CategoryFilter) => ({ ...x, isChecked: newChecked }));
            }

            const allChecked = updated.slice(1).every((item: CategoryFilter) => item.isChecked);
            updated[0] = {
                ...updated[0],
                isChecked: allChecked,
                title: allChecked
                    ? translate('pages.mapFilteredSearch.labels.unSelectAll')
                    : translate('pages.mapFilteredSearch.labels.selectAll'),
            };
            return updated;
        });
    }, [translate]);

    const onSearchOrderSelect = useCallback((value: string) => {
        setActiveMomentsFilters({ order: value });
    }, [setActiveMomentsFilters]);

    const brandColor = theme.colors.brandingBlueGreen;
    const selectAllFilter = categoryFilters[0];
    const individualFilters = categoryFilters.slice(1);

    return (
        <>
            <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
            <SafeAreaView style={theme.styles.safeAreaView}>
                <ScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    style={theme.styles.scrollViewFull}
                >
                    <View style={[theme.styles.body, styles.container]}>
                        {/* Sort Order */}
                        <Text
                            variant="titleMedium"
                            style={[theme.styles.sectionTitle, styles.sectionHeader]}
                        >
                            {translate('pages.advancedSearch.labels.searchOrder')}
                        </Text>
                        <SegmentedButtons
                            value={content.activeAreasFilters?.order || 'DESC'}
                            onValueChange={onSearchOrderSelect}
                            buttons={[
                                {
                                    value: 'DESC',
                                    label: translate('pages.advancedSearch.labels.desc'),
                                    icon: 'sort-descending',
                                },
                                {
                                    value: 'ASC',
                                    label: translate('pages.advancedSearch.labels.asc'),
                                    icon: 'sort-ascending',
                                },
                            ]}
                            style={styles.segmentedButtons}
                        />

                        <Divider style={styles.divider} />

                        {/* Category Filters */}
                        <Text
                            variant="titleMedium"
                            style={[theme.styles.sectionTitle, styles.sectionHeader]}
                        >
                            {translate('pages.advancedSearch.labels.categories')}
                        </Text>

                        {/* Select All / Deselect All */}
                        {selectAllFilter && (
                            <Chip
                                mode={selectAllFilter.isChecked ? 'flat' : 'outlined'}
                                selected={selectAllFilter.isChecked}
                                style={[
                                    styles.selectAllChip,
                                    selectAllFilter.isChecked
                                        ? { backgroundColor: brandColor }
                                        : { backgroundColor: theme.colors.backgroundWhite },
                                ]}
                                textStyle={[
                                    selectAllFilter.isChecked
                                        ? themeForms.styles.buttonPillTitleInvert
                                        : themeForms.styles.buttonPillTitle,
                                    styles.selectAllChipText,
                                ]}
                                selectedColor={theme.colors.brandingWhite}
                                onPress={() => handleCategoryChipPress(0, true)}
                            >
                                {selectAllFilter.title}
                            </Chip>
                        )}

                        {/* Individual category chips */}
                        <View style={styles.chipsContainer}>
                            {individualFilters.map((category: CategoryFilter, index: number) => (
                                <Chip
                                    key={category.name}
                                    compact
                                    mode={category.isChecked ? 'flat' : 'outlined'}
                                    selected={category.isChecked}
                                    selectedColor={theme.colors.brandingWhite}
                                    style={[
                                        styles.chip,
                                        category.isChecked
                                            ? { backgroundColor: brandColor }
                                            : { backgroundColor: theme.colors.backgroundWhite },
                                    ]}
                                    textStyle={
                                        category.isChecked
                                            ? themeForms.styles.buttonPillTitleInvert
                                            : themeForms.styles.buttonPillTitle
                                    }
                                    onPress={() => handleCategoryChipPress(index + 1, false)}
                                >
                                    {category.title}
                                </Chip>
                            ))}
                        </View>
                    </View>
                </ScrollView>

                {/* Footer */}
                <View style={[styles.footer, { backgroundColor: theme.colors.primary, borderTopColor: theme.colors.accentDivider }]}>
                    <Button
                        mode="outlined"
                        onPress={() => navigation.goBack()}
                        icon="arrow-left"
                        textColor={brandColor}
                        style={styles.footerButton}
                    >
                        Back
                    </Button>
                    <Button
                        mode="outlined"
                        onPress={handleResetFilters}
                        icon="refresh"
                        textColor={brandColor}
                        style={styles.footerButton}
                    >
                        Reset
                    </Button>
                </View>
            </SafeAreaView>
            <MainButtonMenu
                navigation={navigation}
                onActionButtonPress={handleResetFilters}
                translate={translate}
                user={user}
                themeMenu={themeMenu}
            />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 120,
    },
    sectionHeader: {
        marginBottom: 12,
    },
    segmentedButtons: {
        marginBottom: 24,
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
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    footerButton: {
        flex: 1,
        marginHorizontal: 6,
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(AdvancedSearch);
