import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ContentActions } from 'therr-react/redux/actions';
import {
    Container,
    Group,
    SimpleGrid,
    Skeleton,
    Stack,
    Text,
    Title,
    UnstyledButton,
    Paper,
    ThemeIcon,
} from '@mantine/core';
import { MantineSearchBox } from 'therr-react/components/mantine';
import useTranslation from '../../hooks/useTranslation';
import Tile from '../Discovered/Tile';

interface ICategoryCard {
    titleKey: string;
    descriptionKey: string;
    path: string;
    color: string;
    emoji: string;
}

const categories: ICategoryCard[] = [
    {
        titleKey: 'pages.explore.categories.momentsTitle',
        descriptionKey: 'pages.explore.categories.momentsDescription',
        path: '/posts/moments',
        color: 'blue',
        emoji: '📸',
    },
    {
        titleKey: 'pages.explore.categories.spacesTitle',
        descriptionKey: 'pages.explore.categories.spacesDescription',
        path: '/locations',
        color: 'teal',
        emoji: '📍',
    },
    {
        titleKey: 'pages.explore.categories.thoughtsTitle',
        descriptionKey: 'pages.explore.categories.thoughtsDescription',
        path: '/posts/thoughts',
        color: 'violet',
        emoji: '💭',
    },
    {
        titleKey: 'pages.explore.categories.peopleTitle',
        descriptionKey: 'pages.explore.categories.peopleDescription',
        path: '/users',
        color: 'orange',
        emoji: '👥',
    },
];

const Explore: React.FC = () => {
    const { t: translate } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const content = useSelector((state: any) => state.content);
    const user = useSelector((state: any) => state.user);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

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
        document.title = `Therr | ${translate('pages.explore.pageTitle')}`;
        handleRefresh();
    }, []); // eslint-disable-line

    const handleSearchChange = (_name: string, value: string) => {
        setSearchQuery(value);
    };

    const handleSearch = () => {
        if (searchQuery.trim()) {
            navigate(`/locations?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const recentAreas = (content.activeMoments || []).slice(0, 6);
    const hasContent = recentAreas.length > 0;

    return (
        <Container id="page_explore" size="lg" py="xl">
            <Stack gap="xl">
                <div>
                    <Title order={2}>{translate('pages.explore.pageTitle')}</Title>
                    <Text size="sm" c="dimmed">{translate('pages.explore.subtitle')}</Text>
                </div>

                {/* Search Bar */}
                <MantineSearchBox
                    id="explore-search"
                    name="exploreSearch"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onSearch={handleSearch}
                    placeholder={translate('pages.explore.searchPlaceholder')}
                />

                {/* Category Navigation Cards */}
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                    {categories.map((cat) => (
                        <UnstyledButton
                            key={cat.path}
                            onClick={() => navigate(cat.path)}
                            className="explore-category-card"
                        >
                            <Paper
                                withBorder
                                p="lg"
                                radius="md"
                                className="explore-category-paper"
                            >
                                <Stack gap={8} align="center" ta="center">
                                    <ThemeIcon size={48} radius="md" variant="light" color={cat.color}>
                                        <Text size="xl">{cat.emoji}</Text>
                                    </ThemeIcon>
                                    <Text fw={600} size="sm">{translate(cat.titleKey)}</Text>
                                    <Text size="xs" c="dimmed" lineClamp={2}>{translate(cat.descriptionKey)}</Text>
                                </Stack>
                            </Paper>
                        </UnstyledButton>
                    ))}
                </SimpleGrid>

                {/* Recent Content Preview */}
                <div>
                    <Group justify="space-between" align="center" mb="md">
                        <Title order={3}>{translate('pages.explore.recentContent')}</Title>
                        <Text
                            size="sm"
                            c="blue"
                            style={{ cursor: 'pointer' }}
                            onClick={() => navigate('/discovered')}
                        >
                            {translate('pages.explore.viewAll')}
                        </Text>
                    </Group>

                    {isLoading && (
                        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <Skeleton key={i} height={280} radius="md" />
                            ))}
                        </SimpleGrid>
                    )}

                    {!isLoading && !hasContent && (
                        <Paper withBorder p="xl" radius="md">
                            <Text ta="center" c="dimmed">{translate('pages.explore.noResults')}</Text>
                        </Paper>
                    )}

                    {!isLoading && hasContent && (
                        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                            {recentAreas.map((area) => (
                                <Tile
                                    key={area.id}
                                    area={area}
                                    areaType={area.areaType}
                                    userDetails={user.details}
                                />
                            ))}
                        </SimpleGrid>
                    )}
                </div>
            </Stack>
        </Container>
    );
};

export default Explore;
