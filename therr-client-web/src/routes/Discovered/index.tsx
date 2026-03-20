import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ContentActions } from 'therr-react/redux/actions';
import {
    Button,
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
import Tile from './Tile';

const Discovered: React.FC = () => {
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
            ...content.activeAreasFilters,
            blockedUsers: user.details.blockedUsers,
            shouldHideMatureContent: user.details.shouldHideMatureContent,
        };

        const momentsPromise = dispatch(ContentActions.updateActiveMomentsStream(sharedParams) as any);
        const spacesPromise = dispatch(ContentActions.updateActiveSpacesStream(sharedParams) as any);

        Promise.all([momentsPromise, spacesPromise])
            .catch((err) => console.log(err))
            .finally(() => setIsLoading(false));
    }, [dispatch, content.activeAreasFilters, user.details.blockedUsers, user.details.shouldHideMatureContent]);

    useEffect(() => {
        document.title = `Therr | ${translate('pages.discovered.pageTitle')}`;
        handleRefresh();
    }, []); // eslint-disable-line

    const areas = content.activeMoments || [];

    const filteredAreas = useMemo(() => {
        if (filter === 'moments') return areas.filter((a) => a.areaType !== 'spaces');
        if (filter === 'spaces') return areas.filter((a) => a.areaType === 'spaces');
        return areas;
    }, [areas, filter]);

    const hasContent = filteredAreas.length > 0;

    const filterData = [
        { label: translate('pages.discovered.filters.all'), value: 'all' },
        { label: translate('pages.discovered.filters.moments'), value: 'moments' },
        { label: translate('pages.discovered.filters.spaces'), value: 'spaces' },
    ];

    return (
        <Container id="page_discovered" size="lg" py="xl">
            <Stack gap="lg">
                <Group justify="space-between" align="center">
                    <div>
                        <Title order={2}>{translate('pages.discovered.pageTitle')}</Title>
                        <Text size="sm" c="dimmed">{translate('pages.discovered.subtitle')}</Text>
                    </div>
                </Group>

                {!isLoading && areas.length > 0 && (
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
                                <Text size="xl">🔍</Text>
                            </ThemeIcon>
                            <Text ta="center" c="dimmed">{translate('pages.discovered.noResults')}</Text>
                            <Button variant="light" onClick={() => navigate('/locations')}>
                                {translate('pages.discovered.exploreCta')}
                            </Button>
                        </Stack>
                    </Paper>
                )}

                {!isLoading && hasContent && (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {filteredAreas.map((area) => (
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

export default Discovered;
