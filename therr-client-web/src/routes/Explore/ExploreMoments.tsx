import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { ContentActions } from 'therr-react/redux/actions';
import {
    Anchor,
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
} from '@mantine/core';
import translator from '../../services/translator';
import Tile from '../Discovered/Tile';

const translate = (key: string, params?: any) => translator('en-us', key, params);

const ExploreMoments: React.FC = () => {
    const dispatch = useDispatch();
    const content = useSelector((state: any) => state.content);
    const user = useSelector((state: any) => state.user);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const fetchMoments = useCallback((offset = 0, isRefresh = true) => {
        const params = {
            withMedia: true,
            withUser: true,
            offset,
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        };

        if (isRefresh) {
            setIsLoading(true);
            return dispatch(ContentActions.updateActiveMomentsStream(params) as any)
                .catch((err) => console.log(err))
                .finally(() => setIsLoading(false));
        }

        setIsLoadingMore(true);
        return dispatch(ContentActions.searchActiveMoments(params) as any)
            .catch((err) => console.log(err))
            .finally(() => setIsLoadingMore(false));
    }, [dispatch, content.activeAreasFilters, user.details.blockedUsers, user.details.shouldHideMatureContent]);

    useEffect(() => {
        document.title = `Therr | ${translate('pages.exploreMoments.pageTitle')}`;
        fetchMoments(0, true);
    }, []); // eslint-disable-line

    const moments = (content.activeMoments || []).filter((a) => a.areaType === 'moments');
    const hasContent = moments.length > 0;
    const pagination = content.activeMomentsPagination;
    const hasMore = pagination && moments.length < (pagination.totalResults || 0);

    const handleLoadMore = () => {
        fetchMoments(moments.length, false);
    };

    const breadcrumbs = [
        <Anchor component={Link} to="/" key="home" size="sm">Home</Anchor>,
        <Anchor component={Link} to="/explore" key="explore" size="sm">Explore</Anchor>,
        <Text size="sm" key="posts">Posts</Text>,
        <Text size="sm" key="moments">Moments</Text>,
    ];

    return (
        <Container id="page_explore_moments" size="lg" py="xl">
            <Stack gap="lg">
                <Breadcrumbs>{breadcrumbs}</Breadcrumbs>

                <div>
                    <Title order={2}>{translate('pages.exploreMoments.pageTitle')}</Title>
                    <Text size="sm" c="dimmed">{translate('pages.exploreMoments.subtitle')}</Text>
                </div>

                {isLoading && (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Skeleton key={i} height={280} radius="md" />
                        ))}
                    </SimpleGrid>
                )}

                {!isLoading && !hasContent && (
                    <Alert variant="light" color="gray" radius="md">
                        <Text ta="center" c="dimmed">{translate('pages.exploreMoments.noResults')}</Text>
                    </Alert>
                )}

                {!isLoading && hasContent && (
                    <>
                        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                            {moments.map((area) => (
                                <Tile
                                    key={area.id}
                                    area={area}
                                    areaType="moments"
                                    userDetails={user.details}
                                />
                            ))}
                        </SimpleGrid>
                        {hasMore && (
                            <Group justify="center">
                                <Button
                                    variant="outline"
                                    onClick={handleLoadMore}
                                    loading={isLoadingMore}
                                >
                                    {translate('pages.exploreMoments.loadMore')}
                                </Button>
                            </Group>
                        )}
                    </>
                )}
            </Stack>
        </Container>
    );
};

export default ExploreMoments;
