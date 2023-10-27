import React from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { Picker as ReactPicker } from '@react-native-picker/picker';
import { bindActionCreators } from 'redux';
import { ContentActions, MapActions } from 'therr-react/redux/actions';
import { IContentState, IMapState as IMapReduxState, IUserState, IUserConnectionsState } from 'therr-react/types';
import { buildStyles } from '../../styles';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import translator from '../../services/translator';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import CategoryPills from '../../components/CategoryPills';
import { Button } from 'react-native-elements';
import TherrIcon from '../../components/TherrIcon';
import { getInitialCategoryFilters } from '../../utilities/getInitialFilters';

// const { width: viewportWidth, height: viewportHeight } = Dimensions.get('window');

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

// Regular component props
export interface IAdvancedSearchProps extends IStoreProps {
    navigation: any;
}

interface IAdvancedSearchState {
    categoryFilters: { title: string; name: string; isChecked?: boolean }[],
    isLoading: boolean;
    hasChanges: boolean;
}

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

class AdvancedSearch extends React.Component<IAdvancedSearchProps, IAdvancedSearchState> {
    private carouselRef;
    private initialCategoryFilters;
    private translate: (key: string, params?: any) => string;
    private unsubscribeNavListener;
    private theme = buildStyles();
    private themeForms = buildFormStyles();
    private themeMenu = buildMenuStyles();

    constructor(props) {
        super(props);

        this.translate = (key: string, params?: any) =>
            translator('en-us', key, params);
        this.initialCategoryFilters = getInitialCategoryFilters(this.translate);

        const filtersArePopulated = props.map.filtersCategory?.length;

        this.state = {
            categoryFilters: filtersArePopulated
                ? JSON.parse(JSON.stringify(props.map.filtersCategory))
                : this.initialCategoryFilters.map(x => ({ ...x, isChecked: true})),
            isLoading: true,
            hasChanges: false,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
    }

    componentDidMount() {
        const { content, navigation, updateActiveMomentsStream } = this.props;

        navigation.setOptions({
            title: this.translate('pages.advancedSearch.headerTitle'),
        });

        if (!content?.activeAdvancedSearch?.length || content.activeAdvancedSearch.length < 21) {
            Promise.resolve().finally(() => {
                this.setState({
                    isLoading: false,
                });
            });
        }

        this.unsubscribeNavListener = navigation.addListener('beforeRemove', () => {
            updateActiveMomentsStream({
                withMedia: true,
                withUser: true,
                offset: 0,
                ...this.props.content.activeAreasFilters,
            });
        });
    }

    componentWillUnmount() {
        this.unsubscribeNavListener();
    }

    handleApplyFilters = () => {
        const { categoryFilters } = this.state;
        const { setMapFilters } = this.props;

        setMapFilters({
            filtersCategory: categoryFilters,
        });
    };

    handleResetFilters = () => {
        this.setState({
            categoryFilters: this.initialCategoryFilters.map(x => ({ ...x, isChecked: true})),
        }, this.handleApplyFilters);
    };

    handleFilterBadgePress = (filterGroup: 'categoryFilters', index, isSelectAll: boolean = false) => {
        let modifiedGroup = this.state[filterGroup];
        modifiedGroup[index].isChecked = !modifiedGroup[index].isChecked;
        if (isSelectAll) {
            modifiedGroup = modifiedGroup.map(x => ({ ...x, isChecked: modifiedGroup[index].isChecked}));
        } else {
            // Select All box
            modifiedGroup[0].isChecked = modifiedGroup.every((item, i) => {
                if (i === 0) { return true; }
                return item.isChecked;
            });
        }

        // Apply filters immediately on press
        this.setState({
            [filterGroup]: modifiedGroup,
        } as any, this.handleApplyFilters);
    };

    goBack = () => {
        const { navigation } = this.props;
        navigation.goBack();
    };

    onRefresh = () => {
        // TODO: Reset Filters
        console.log('Refresh');
        this.handleResetFilters();
    };

    onFiltersChanged = () => {
        this.setState({
            hasChanges: true,
        });
    };

    onSearchOrderSelect = (searchOrder) => {
        const { setActiveMomentsFilters } = this.props;

        this.onFiltersChanged();
        setActiveMomentsFilters({
            order: searchOrder,
        });
    };

    render() {
        const { content, map, navigation, user } = this.props;
        const { categoryFilters } = this.state;
        const mapFilters = {
            filtersAuthor: map.filtersAuthor,
            filtersCategory: categoryFilters,
            filtersVisibility: map.filtersVisibility,
        };

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <ScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        style={this.theme.styles.scrollViewFull}
                    >
                        <View style={this.theme.styles.body}>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {this.translate('pages.advancedSearch.labels.searchOrder')}
                                </Text>
                                <View style={this.theme.styles.sectionForm}>
                                    <ReactPicker
                                        selectedValue={content.activeAreasFilters.order}
                                        style={this.themeForms.styles.picker}
                                        itemStyle={this.themeForms.styles.pickerItem}
                                        onValueChange={this.onSearchOrderSelect}>
                                        <ReactPicker.Item label={this.translate(
                                            'pages.advancedSearch.labels.desc'
                                        )} value="DESC" />
                                        <ReactPicker.Item label={this.translate(
                                            'pages.advancedSearch.labels.asc'
                                        )} value="ASC" />
                                    </ReactPicker>
                                </View>
                            </View>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {this.translate('pages.advancedSearch.labels.categories')}
                                </Text>
                                <View style={this.theme.styles.sectionForm}>
                                    <CategoryPills
                                        filters={mapFilters}
                                        onPillPress={this.handleFilterBadgePress}
                                        themeForms={this.themeForms}
                                        translate={this.translate}
                                    />
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                    <View style={[this.theme.styles.footer, this.theme.styles.footer]}>
                        <Button
                            containerStyle={this.themeForms.styles.leftButtonContainer}
                            buttonStyle={this.themeForms.styles.backButton}
                            onPress={() => this.goBack()}
                            icon={
                                <TherrIcon
                                    name="go-back"
                                    size={25}
                                    color={'black'}
                                />
                            }
                            type="clear"
                        />
                        <Button
                            containerStyle={this.themeForms.styles.rightButtonContainer}
                            buttonStyle={this.themeForms.styles.backButton}
                            onPress={() => this.onRefresh()}
                            icon={
                                <TherrIcon
                                    name="refresh"
                                    size={25}
                                    color={'black'}
                                />
                            }
                            type="clear"
                        />
                    </View>
                </SafeAreaView>
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

export default connect(mapStateToProps, mapDispatchToProps)(AdvancedSearch);
