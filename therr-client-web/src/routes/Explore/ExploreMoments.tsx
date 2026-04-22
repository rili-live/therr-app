import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { ContentActions } from 'therr-react/redux/actions';
import {
    Anchor,
    Breadcrumbs,
    Button,
    Container,
    Group,
    SimpleGrid,
    Skeleton,
    Stack,
    Text,
    Title,
    Alert,
} from '@mantine/core';
import useTranslation from '../../hooks/useTranslation';
import Tile from '../Discovered/Tile';

const ITEMS_PER_PAGE = 30;

const ExploreMoments: React.FC = () => {
    const { t: translate } = useTranslation();
    const dispatch = useDispatch();
    const content = useSelector((state: any) => state.content);
    const user = useSelector((state: any) => state.user);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchMoments = useCallback((page = 1) => {
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const params = {
            withMedia: true,
            withUser: true,
            offset,
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        };

        setIsLoading(true);
        return dispatch(ContentActions.updateActiveMomentsStream(params, ITEMS_PER_PAGE) as any)
            .catch((err) => console.log(err))
            .finally(() => setIsLoading(false));
    }, [dispatch, content.activeAreasFilters, user.details.blockedUsers, user.details.shouldHideMatureContent]);

    useEffect(() => {
        document.title = `Therr | ${translate('pages.exploreMoments.pageTitle')}`;
        fetchMoments(1);
    }, []); // eslint-disable-line

    const moments = (content.activeMoments || []).filter((a) => a.areaType === 'moments');
    const hasContent = moments.length > 0;
    const pagination = content.activeMomentsPagination;
    const isLastPage = pagination?.isLastPage !== false && moments.length < ITEMS_PER_PAGE;
    const hasPrev = currentPage > 1;
    const hasNext = !isLastPage;

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        fetchMoments(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const breadcrumbs = [
        <Anchor component={Link} to="/" key="home" size="sm">{translate('pages.navigation.home')}</Anchor>,
        <Anchor component={Link} to="/explore" key="explore" size="sm">{translate('pages.navigation.explore')}</Anchor>,
        <Text size="sm" key="posts">{translate('pages.navigation.posts')}</Text>,
        <Text size="sm" key="moments">{translate('pages.navigation.moments')}</Text>,
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

export default ExploreMoments;
