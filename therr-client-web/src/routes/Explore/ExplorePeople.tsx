import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
    Anchor,
    Avatar,
    Breadcrumbs,
    Container,
    Group,
    SimpleGrid,
    Skeleton,
    Stack,
    Text,
    Title,
    Alert,
    Button,
    Card,
} from '@mantine/core';
import { MantineSearchBox } from 'therr-react/components/mantine';
import UsersActions from '../../redux/actions/UsersActions';
import getUserImageUri from '../../utilities/getUserImageUri';
import useTranslation from '../../hooks/useTranslation';

const ITEMS_PER_PAGE = 30;

const ExplorePeople: React.FC = () => {
    const { t: translate } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const user = useSelector((state: any) => state.user);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeQuery, setActiveQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [lastResultCount, setLastResultCount] = useState(0);

    const fetchUsers = useCallback((query = '', page = 1) => {
        setIsLoading(true);
        const args: any = {
            limit: ITEMS_PER_PAGE,
            offset: (page - 1) * ITEMS_PER_PAGE,
        };
        if (query.trim()) {
            args.query = query.trim();
            args.queryColumnName = 'userName';
        }
        dispatch(UsersActions.search(args) as any)
            .then((data: any) => {
                setLastResultCount(data?.results?.length || 0);
            })
            .catch((err) => console.log(err))
            .finally(() => setIsLoading(false));
    }, [dispatch]);

    useEffect(() => {
        document.title = `Therr | ${translate('pages.explorePeople.pageTitle')}`;
        fetchUsers();
    }, []); // eslint-disable-line

    const handleSearchChange = (_name: string, value: string) => {
        setSearchQuery(value);
    };

    const handleSearch = () => {
        setActiveQuery(searchQuery);
        setCurrentPage(1);
        fetchUsers(searchQuery, 1);
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setActiveQuery('');
        setCurrentPage(1);
        fetchUsers('', 1);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        fetchUsers(activeQuery, page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const getInitials = (u: any) => {
        const first = u.firstName?.[0] || '';
        const last = u.lastName?.[0] || '';
        return (first + last).toUpperCase() || u.userName?.[0]?.toUpperCase() || '?';
    };

    const breadcrumbs = [
        <Anchor component={Link} to="/" key="home" size="sm">{translate('pages.navigation.home')}</Anchor>,
        <Anchor component={Link} to="/explore" key="explore" size="sm">{translate('pages.navigation.explore')}</Anchor>,
        <Text size="sm" key="users">{translate('pages.navigation.users')}</Text>,
    ];

    const users = Object.values(user.users || {}) as any[];
    const hasContent = users.length > 0;
    const hasPrev = currentPage > 1;
    const hasNext = lastResultCount >= ITEMS_PER_PAGE;

    return (
        <Container id="page_explore_people" size="lg" py="xl">
            <Stack gap="lg">
                <Breadcrumbs>{breadcrumbs}</Breadcrumbs>

                <div>
                    <Title order={2}>{translate('pages.explorePeople.pageTitle')}</Title>
                    <Text size="sm" c="dimmed">{translate('pages.explorePeople.subtitle')}</Text>
                </div>

                {/* Search */}
                <Group gap="sm">
                    <MantineSearchBox
                        id="people-search"
                        name="peopleSearch"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onSearch={handleSearch}
                        placeholder={translate('pages.explorePeople.searchPlaceholder')}
                        style={{ flex: 1 }}
                    />
                    <Button variant="filled" size="sm" onClick={handleSearch}>
                        {translate('pages.navigation.search')}
                    </Button>
                    {activeQuery && (
                        <Button variant="subtle" size="sm" onClick={handleClearSearch}>
                            {translate('pages.navigation.clear')}
                        </Button>
                    )}
                </Group>

                {isLoading && (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Skeleton key={i} height={100} radius="md" />
                        ))}
                    </SimpleGrid>
                )}

                {!isLoading && !hasContent && (
                    <Alert variant="light" color="gray" radius="md">
                        <Text ta="center" c="dimmed">{translate('pages.explorePeople.noResults')}</Text>
                    </Alert>
                )}

                {!isLoading && hasContent && (
                    <>
                        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                            {users.map((u) => (
                                <Card
                                    key={u.id}
                                    shadow="sm"
                                    padding="md"
                                    radius="md"
                                    withBorder
                                    className="discovered-tile"
                                    onClick={() => navigate(`/users/${u.id}`)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <Group wrap="nowrap">
                                        <Avatar
                                            src={getUserImageUri({ details: u }, 200)}
                                            alt={`${u.firstName} ${u.lastName}`}
                                            size="lg"
                                            radius="xl"
                                            color="blue"
                                        >
                                            {getInitials(u)}
                                        </Avatar>
                                        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                                            <Text fw={600} size="sm" lineClamp={1}>
                                                {u.firstName} {u.lastName}
                                            </Text>
                                            <Text size="xs" c="dimmed" lineClamp={1}>
                                                @{u.userName}
                                            </Text>
                                            {u.settingsBio && (
                                                <Text size="xs" c="dimmed" lineClamp={2}>
                                                    {u.settingsBio}
                                                </Text>
                                            )}
                                        </Stack>
                                    </Group>
                                </Card>
                            ))}
                        </SimpleGrid>
                        {(hasPrev || hasNext) && (
                            <Group justify="center" gap="md">
                                <Button
                                    variant="outline"
                                    disabled={!hasPrev}
                                    onClick={() => handlePageChange(currentPage - 1)}
                                >
                                    {translate('pages.navigation.previous')}
                                </Button>
                                <Text size="sm" c="dimmed">{translate('pages.navigation.page', { pageNumber: currentPage })}</Text>
                                <Button
                                    variant="outline"
                                    disabled={!hasNext}
                                    onClick={() => handlePageChange(currentPage + 1)}
                                >
                                    {translate('pages.navigation.next')}
                                </Button>
                            </Group>
                        )}
                    </>
                )}
            </Stack>
        </Container>
    );
};

export default ExplorePeople;
