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
import translator from '../../services/translator';

const translate = (key: string, params?: any) => translator('en-us', key, params);

const ITEMS_PER_PAGE = 30;

const ExplorePeople: React.FC = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const user = useSelector((state: any) => state.user);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchUsers = useCallback((query = '') => {
        setIsLoading(true);
        const args: any = {
            limit: ITEMS_PER_PAGE,
            offset: 0,
        };
        if (query.trim()) {
            args.query = query.trim();
            args.queryColumnName = 'userName';
        }
        dispatch(UsersActions.search(args) as any)
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
        fetchUsers(searchQuery);
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        fetchUsers('');
    };

    const getInitials = (u: any) => {
        const first = u.firstName?.[0] || '';
        const last = u.lastName?.[0] || '';
        return (first + last).toUpperCase() || u.userName?.[0]?.toUpperCase() || '?';
    };

    const breadcrumbs = [
        <Anchor component={Link} to="/" key="home" size="sm">Home</Anchor>,
        <Anchor component={Link} to="/explore" key="explore" size="sm">Explore</Anchor>,
        <Text size="sm" key="users">Users</Text>,
    ];

    const users = Object.values(user.users || {}) as any[];
    const hasContent = users.length > 0;

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
                    {searchQuery && (
                        <Button variant="subtle" size="sm" onClick={handleClearSearch}>
                            Clear
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
                                    <Avatar size="lg" radius="xl" color="blue">
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
                )}
            </Stack>
        </Container>
    );
};

export default ExplorePeople;
