import React, {
    useCallback, useEffect, useMemo, useState,
} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ContentActions } from 'therr-react/redux/actions';
import {
    Badge,
    Button,
    Card,
    Container,
    Group,
    SegmentedControl,
    Skeleton,
    SimpleGrid,
    Stack,
    Text,
    ThemeIcon,
    Title,
    Paper,
} from '@mantine/core';
import useTranslation from '../../hooks/useTranslation';
import Tile from '../Discovered/Tile';

type TabValue = 'lists' | 'moments' | 'thoughts' | 'events';

const Bookmarks: React.FC = () => {
    const { t: translate } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const content = useSelector((state: any) => state.content);
    const user = useSelector((state: any) => state.user);
    const [isLoading, setIsLoading] = useState(true);
    const [tab, setTab] = useState<TabValue>('lists');

    const handleRefresh = useCallback(() => {
        setIsLoading(true);

        const sharedParams = {
            withMedia: true,
            withUser: true,
            offset: 0,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        };

        const listsPromise = dispatch(ContentActions.fetchUserLists(true) as any);
        const momentsPromise = dispatch(ContentActions.searchBookmarkedMoments(sharedParams) as any);
        const thoughtsPromise = dispatch(ContentActions.searchBookmarkedThoughts(sharedParams) as any);

        Promise.all([listsPromise, momentsPromise, thoughtsPromise])
            .catch((err) => console.log(err))
            .finally(() => setIsLoading(false));
    }, [dispatch, user.details.blockedUsers, user.details.shouldHideMatureContent]);

    useEffect(() => {
        document.title = `Therr | ${translate('pages.bookmarks.pageTitle')}`;
        handleRefresh();
    }, []); // eslint-disable-line

    const userLists = content.userLists || [];

    const bookmarkedMoments = useMemo(() => (content.bookmarkedMoments || []).map((m: any) => ({
        ...m,
        areaType: 'moments',
    })), [content.bookmarkedMoments]);

    const bookmarkedThoughts = useMemo(() => (content.bookmarkedThoughts || []).map((t: any) => ({
        ...t,
        areaType: 'thoughts',
    })), [content.bookmarkedThoughts]);

    const tabData = [
        { label: translate('pages.bookmarks.tabs.lists'), value: 'lists' },
        { label: translate('pages.bookmarks.tabs.moments'), value: 'moments' },
        { label: translate('pages.bookmarks.tabs.thoughts'), value: 'thoughts' },
    ];

    const activeItems = useMemo(() => {
        if (tab === 'moments') return bookmarkedMoments;
        if (tab === 'thoughts') return bookmarkedThoughts;
        return [];
    }, [tab, bookmarkedMoments, bookmarkedThoughts]);

    const renderListCard = (list: any) => (
        <Card
            key={list.id}
            shadow="sm"
            padding={0}
            radius="md"
            withBorder
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/bookmarks/lists/${list.id}`)}
        >
            <Card.Section style={{
                height: 140,
                background: list.colorHex || '#f1f3f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            >
                <Text size="xl" c="dimmed">
                    {list.name?.charAt(0)?.toUpperCase() || '*'}
                </Text>
            </Card.Section>
            <Card.Section p="sm">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text fw={600} size="sm" lineClamp={1}>{list.name}</Text>
                        <Text size="xs" c="dimmed">
                            {translate('pages.bookmarks.lists.itemCount', { count: list.itemCount ?? 0 })}
                        </Text>
                    </div>
                    {list.isDefault && (
                        <Badge variant="light" size="xs" color="teal">
                            {translate('pages.bookmarks.lists.default')}
                        </Badge>
                    )}
                </Group>
            </Card.Section>
        </Card>
    );

    return (
        <Container id="page_bookmarks" size="lg" py="xl">
            <Stack gap="lg">
                <Group justify="space-between" align="center">
                    <div>
                        <Title order={2}>{translate('pages.bookmarks.pageTitle')}</Title>
                        <Text size="sm" c="dimmed">{translate('pages.bookmarks.subtitle')}</Text>
                    </div>
                </Group>

                <SegmentedControl
                    value={tab}
                    onChange={(v) => setTab(v as TabValue)}
                    data={tabData}
                    size="sm"
                />

                {isLoading && (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Skeleton key={i} height={220} radius="md" />
                        ))}
                    </SimpleGrid>
                )}

                {!isLoading && tab === 'lists' && userLists.length === 0 && (
                    <Paper withBorder p="xl" radius="md">
                        <Stack align="center" gap="md">
                            <ThemeIcon size={64} radius="xl" variant="light" color="teal">
                                <Text size="xl">{'*'}</Text>
                            </ThemeIcon>
                            <Text ta="center" c="dimmed">{translate('pages.bookmarks.lists.emptyState')}</Text>
                            <Button variant="light" onClick={() => navigate('/locations')}>
                                {translate('pages.bookmarks.lists.browseSpaces')}
                            </Button>
                        </Stack>
                    </Paper>
                )}

                {!isLoading && tab === 'lists' && userLists.length > 0 && (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {userLists.map(renderListCard)}
                    </SimpleGrid>
                )}

                {!isLoading && tab !== 'lists' && activeItems.length === 0 && (
                    <Paper withBorder p="xl" radius="md">
                        <Stack align="center" gap="md">
                            <ThemeIcon size={64} radius="xl" variant="light" color="teal">
                                <Text size="xl">{'*'}</Text>
                            </ThemeIcon>
                            <Text ta="center" c="dimmed">{translate('pages.bookmarks.noResults')}</Text>
                            <Button variant="light" onClick={() => navigate('/discovered')}>
                                {translate('pages.bookmarks.exploreCta')}
                            </Button>
                        </Stack>
                    </Paper>
                )}

                {!isLoading && tab !== 'lists' && activeItems.length > 0 && (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {activeItems.map((area: any) => (
                            <Tile
                                key={area.id}
                                area={area}
                                areaType={area.areaType}
                                userDetails={user.details}
                            />
                        ))}
                    </SimpleGrid>
                )}
            </Stack>
        </Container>
    );
};

export default Bookmarks;
