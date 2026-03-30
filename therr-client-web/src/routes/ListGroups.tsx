/* eslint-disable max-len */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Link, NavigateFunction } from 'react-router-dom';
import { ForumActions } from 'therr-react/redux/actions';
import { IForumsState, IUserState } from 'therr-react/types';
import { GroupRequestStatuses } from 'therr-js-utilities/constants';
import {
    Anchor,
    Avatar,
    Badge,
    Card,
    Container,
    Flex,
    Group as MantineGroup,
    Stack,
    Tabs,
    Text,
    TextInput,
    Title,
} from '@mantine/core';
import { IconSearch, IconMapPin } from '@tabler/icons-react';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';
import UsersActions from '../redux/actions/UsersActions';

const DEFAULT_PAGE_SIZE = 50;

interface IListGroupsRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
}

interface IListGroupsDispatchProps {
    getUserGroups: Function;
    searchForums: Function;
    searchMyForums: Function;
    searchCategories: Function;
}

interface IStoreProps extends IListGroupsDispatchProps {
    forums: IForumsState;
    user: IUserState;
}

interface IListGroupsProps extends IListGroupsRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
}

interface IListGroupsState {
    activeTab: string;
    searchText: string;
    citySearchText: string;
    categories: any[];
    isRefreshing: boolean;
}

const mapStateToProps = (state: any) => ({
    forums: state.forums,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getUserGroups: UsersActions.getUserGroups,
    searchForums: ForumActions.searchForums,
    searchMyForums: ForumActions.searchMyForums,
    searchCategories: ForumActions.searchCategories,
}, dispatch);

export class ListGroupsComponent extends React.Component<IListGroupsProps, IListGroupsState> {
    private searchDebounceTimer: any;

    constructor(props: IListGroupsProps) {
        super(props);

        this.state = {
            activeTab: 'discover',
            searchText: '',
            citySearchText: '',
            categories: [],
            isRefreshing: false,
        };
    }

    static getDerivedStateFromProps(nextProps: IListGroupsProps, nextState: IListGroupsState) {
        if (!nextState.categories.length && nextProps.forums?.forumCategories?.length) {
            return {
                categories: nextProps.forums.forumCategories.map((c) => ({ ...c, isActive: false })),
            };
        }
        return null;
    }

    componentDidMount() {
        const {
            forums, searchCategories, user, getUserGroups,
        } = this.props;

        document.title = `Therr | ${this.props.translate('pages.listGroups.pageTitle')}`;

        if (!forums?.searchResults?.length) {
            this.handleSearch();
        }

        if (!forums?.forumCategories?.length) {
            searchCategories({
                itemsPerPage: 100,
                pageNumber: 1,
                order: 'desc',
            });
        }

        if (user?.details?.id) {
            getUserGroups({ withGroups: true });
            this.handleSearchMyGroups();
        }
    }

    componentWillUnmount() {
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
        }
    }

    handleSearch = () => {
        const { searchForums } = this.props;
        const { searchText, citySearchText, categories } = this.state;

        this.setState({ isRefreshing: true });

        const searchParams: any = {
            itemsPerPage: DEFAULT_PAGE_SIZE,
            pageNumber: 1,
            order: 'desc',
        };
        if (searchText) {
            searchParams.query = searchText;
            searchParams.filterBy = 'title';
            searchParams.filterOperator = 'ilike';
        }

        const searchArgs: any = {};
        const selectedCategoryTags = categories.filter((c) => c.isActive).map((c) => c.tag);
        if (selectedCategoryTags.length) {
            searchArgs.categoryTags = selectedCategoryTags;
        }
        if (citySearchText) {
            searchArgs.nearbyCity = citySearchText;
        }

        searchForums(searchParams, searchArgs)
            .catch(() => { /* noop */ })
            .finally(() => this.setState({ isRefreshing: false }));
    };

    handleSearchMyGroups = () => {
        const { user, searchMyForums } = this.props;

        const myGroupIds = Object.keys(user.myUserGroups || {}).filter(
            (groupId) => user.myUserGroups[groupId]?.status === GroupRequestStatuses.APPROVED,
        );

        if (myGroupIds.length) {
            searchMyForums(
                { itemsPerPage: DEFAULT_PAGE_SIZE, pageNumber: 1, order: 'desc' },
                { forumIds: myGroupIds },
            ).catch(() => { /* noop */ });
        }
    };

    handleSearchTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ searchText: e.target.value }, this.debouncedSearch);
    };

    handleCitySearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ citySearchText: e.target.value }, this.debouncedSearch);
    };

    debouncedSearch = () => {
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
        }
        this.searchDebounceTimer = setTimeout(() => {
            this.handleSearch();
        }, 400);
    };

    handleCategoryToggle = (tag: string) => {
        const { categories } = this.state;
        const updated = categories.map((c) => (c.tag === tag ? { ...c, isActive: !c.isActive } : c));
        this.setState({ categories: updated }, () => {
            this.handleSearch();
        });
    };

    renderGroupCard = (group: any) => {
        const { user } = this.props;
        const membershipStatus = user?.myUserGroups?.[group.id]?.status || '';
        const isUserInGroup = membershipStatus === GroupRequestStatuses.APPROVED;
        const locationText = [group.city, group.region].filter(Boolean).join(', ');

        return (
            <Card
                key={group.id}
                shadow="sm"
                padding="md"
                radius="md"
                withBorder
                mb="sm"
                className="group-list-card"
                style={{ cursor: 'pointer' }}
                onClick={() => this.props.navigation.navigate(`/groups/${group.id}`)}
            >
                <Flex gap="md" align="flex-start">
                    <Avatar
                        src={group.media?.featuredImage?.path || null}
                        radius="md"
                        size="lg"
                        color="blue"
                    >
                        {group.title?.charAt(0)?.toUpperCase() || 'G'}
                    </Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Flex justify="space-between" align="center">
                            <Title order={4} lineClamp={1}>{group.title}</Title>
                            {isUserInGroup && <Badge variant="light" color="green" size="sm">{this.props.translate('pages.listGroups.labels.joined')}</Badge>}
                        </Flex>
                        {locationText && (
                            <Text size="xs" c="dimmed">{locationText}</Text>
                        )}
                        {group.memberCount > 0 && (
                            <Text size="xs" c="dimmed">
                                {this.props.translate('pages.listGroups.labels.memberCount', { count: group.memberCount })}
                            </Text>
                        )}
                        {group.description && (
                            <Text size="sm" mt={4} lineClamp={2}>{group.description}</Text>
                        )}
                        {group.categories?.length > 0 && (
                            <MantineGroup gap={4} mt={4}>
                                {group.categories.map((cat: any) => (
                                    <Badge key={cat.tag} variant="light" size="xs">{cat.tag}</Badge>
                                ))}
                            </MantineGroup>
                        )}
                    </div>
                </Flex>
            </Card>
        );
    };

    renderSearchHeader = () => {
        const { searchText, citySearchText, categories } = this.state;

        return (
            <Stack gap="sm">
                <Flex gap="sm" direction={{ base: 'column', sm: 'row' }}>
                    <TextInput
                        flex={1}
                        placeholder={this.props.translate('pages.listGroups.placeholders.search')}
                        leftSection={<IconSearch size={16} />}
                        value={searchText}
                        onChange={this.handleSearchTextChange}
                    />
                    <TextInput
                        flex={1}
                        placeholder={this.props.translate('pages.listGroups.placeholders.city')}
                        leftSection={<IconMapPin size={16} />}
                        value={citySearchText}
                        onChange={this.handleCitySearchChange}
                    />
                </Flex>
                {categories.length > 0 && (
                    <MantineGroup gap={6}>
                        {categories.map((cat) => (
                            <Badge
                                key={cat.tag}
                                variant={cat.isActive ? 'filled' : 'outline'}
                                size="md"
                                style={{ cursor: 'pointer' }}
                                onClick={() => this.handleCategoryToggle(cat.tag)}
                            >
                                {cat.tag}
                            </Badge>
                        ))}
                    </MantineGroup>
                )}
            </Stack>
        );
    };

    public render(): JSX.Element {
        const { activeTab } = this.state;
        const { forums, user } = this.props;
        const isAuthenticated = !!user?.details?.id;
        const discoverGroups = forums?.searchResults || [];
        const myGroups = forums?.myForumsSearchResults || [];

        return (
            <div id="page_list_groups">
                <Container size="md" py="lg">
                    <Stack gap="md">
                        <Flex justify="space-between" align="center">
                            <Title order={1} size="h2">{this.props.translate('pages.listGroups.pageTitle')}</Title>
                            {isAuthenticated && (
                                <Anchor component={Link} to="/create-forum">
                                    {this.props.translate('pages.listGroups.buttons.createGroup')}
                                </Anchor>
                            )}
                        </Flex>

                        <Tabs
                            value={activeTab}
                            onChange={(value) => this.setState({ activeTab: value || 'discover' })}
                        >
                            <Tabs.List grow mb="md">
                                <Tabs.Tab value="discover">
                                    {this.props.translate('pages.listGroups.tabs.discover')}
                                </Tabs.Tab>
                                {isAuthenticated && (
                                    <Tabs.Tab value="mygroups">
                                        {this.props.translate('pages.listGroups.tabs.myGroups')}
                                    </Tabs.Tab>
                                )}
                            </Tabs.List>
                        </Tabs>

                        {activeTab === 'discover' && (
                            <>
                                {this.renderSearchHeader()}
                                <Stack gap={0} mt="sm">
                                    {discoverGroups.length > 0
                                        ? discoverGroups.map(this.renderGroupCard)
                                        : <Text c="dimmed" ta="center" py="xl">
                                            {this.props.translate('pages.listGroups.noResultsFound')}
                                        </Text>
                                    }
                                </Stack>
                            </>
                        )}

                        {activeTab === 'mygroups' && (
                            <Stack gap={0}>
                                {myGroups.length > 0
                                    ? myGroups.map(this.renderGroupCard)
                                    : <Text c="dimmed" ta="center" py="xl">
                                        {this.props.translate('pages.listGroups.noMyGroupsFound')}
                                    </Text>
                                }
                            </Stack>
                        )}
                    </Stack>
                </Container>
            </div>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(ListGroupsComponent)));
