import React, {
    useCallback, useEffect, useMemo, useState,
} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ContentActions } from 'therr-react/redux/actions';
import {
    Button,
    Container,
    SegmentedControl,
    Skeleton,
    SimpleGrid,
    Stack,
    Text,
    ThemeIcon,
    Title,
    Paper,
    Group,
} from '@mantine/core';
import useTranslation from '../../hooks/useTranslation';
import Tile from '../Discovered/Tile';

const Bookmarks: React.FC = () => {
    const { t: translate } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const content = useSelector((state: any) => state.content);
    const user = useSelector((state: any) => state.user);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    const handleRefresh = useCallback(() => {
        setIsLoading(true);

        const sharedParams = {
            withMedia: true,
            withUser: true,
            offset: 0,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        };

        const momentsPromise = dispatch(ContentActions.searchBookmarkedMoments(sharedParams) as any);
        const spacesPromise = dispatch(ContentActions.searchBookmarkedSpaces(sharedParams) as any);
        const thoughtsPromise = dispatch(ContentActions.searchBookmarkedThoughts(sharedParams) as any);

        Promise.all([momentsPromise, spacesPromise, thoughtsPromise])
            .catch((err) => console.log(err))
            .finally(() => setIsLoading(false));
    }, [dispatch, user.details.blockedUsers, user.details.shouldHideMatureContent]);

    useEffect(() => {
        document.title = `Therr | ${translate('pages.bookmarks.pageTitle')}`;
        handleRefresh();
    }, []); // eslint-disable-line

    const bookmarkedMoments = useMemo(() => (content.bookmarkedMoments || []).map((m) => ({
        ...m,
        areaType: 'moments',
    })), [content.bookmarkedMoments]);

    const bookmarkedSpaces = useMemo(() => (content.bookmarkedSpaces || []).map((s) => ({
        ...s,
        areaType: 'spaces',
    })), [content.bookmarkedSpaces]);

    const bookmarkedThoughts = useMemo(() => (content.bookmarkedThoughts || []).map((t) => ({
        ...t,
        areaType: 'thoughts',
    })), [content.bookmarkedThoughts]);

    const allBookmarks = useMemo(() => {
        let items: any[] = [];
        if (filter === 'all') {
            items = [...bookmarkedMoments, ...bookmarkedSpaces, ...bookmarkedThoughts];
        } else if (filter === 'moments') {
            items = bookmarkedMoments;
        } else if (filter === 'spaces') {
            items = bookmarkedSpaces;
        } else if (filter === 'thoughts') {
            items = bookmarkedThoughts;
        }
        return items;
    }, [filter, bookmarkedMoments, bookmarkedSpaces, bookmarkedThoughts]);

    const hasContent = allBookmarks.length > 0;

    const filterData = [
        { label: translate('pages.bookmarks.filters.all'), value: 'all' },
        { label: translate('pages.bookmarks.filters.moments'), value: 'moments' },
        { label: translate('pages.bookmarks.filters.spaces'), value: 'spaces' },
        { label: translate('pages.bookmarks.filters.thoughts'), value: 'thoughts' },
    ];

    return (
        <Container id="page_bookmarks" size="lg" py="xl">
            <Stack gap="lg">
                <Group justify="space-between" align="center">
                    <div>
                        <Title order={2}>{translate('pages.bookmarks.pageTitle')}</Title>
                        <Text size="sm" c="dimmed">{translate('pages.bookmarks.subtitle')}</Text>
                    </div>
                </Group>

                {!isLoading && hasContent && (
                    <SegmentedControl
                        value={filter}
                        onChange={setFilter}
                        data={filterData}
                        size="sm"
                    />
                )}

                {isLoading && (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Skeleton key={i} height={280} radius="md" />
                        ))}
                    </SimpleGrid>
                )}

                {!isLoading && !hasContent && (
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

                {!isLoading && hasContent && (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {allBookmarks.map((area) => (
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
