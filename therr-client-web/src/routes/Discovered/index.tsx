import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ContentActions } from 'therr-react/redux/actions';
import {
    Alert,
    Container,
    Group,
    Skeleton,
    SimpleGrid,
    Stack,
    Text,
    Title,
} from '@mantine/core';
import useTranslation from '../../hooks/useTranslation';
import Tile from './Tile';

const Discovered: React.FC = () => {
    const { t: translate } = useTranslation();
    const dispatch = useDispatch();
    const content = useSelector((state: any) => state.content);
    const user = useSelector((state: any) => state.user);
    const [isLoading, setIsLoading] = useState(true);

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
    const hasContent = areas.length > 0;

    return (
        <Container id="page_discovered" size="lg" py="xl">
            <Stack gap="lg">
                <Group justify="space-between" align="center">
                    <div>
                        <Title order={2}>{translate('pages.discovered.pageTitle')}</Title>
                        <Text size="sm" c="dimmed">{translate('pages.discovered.subtitle')}</Text>
                    </div>
                </Group>

                {isLoading && (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Skeleton key={i} height={280} radius="md" />
                        ))}
                    </SimpleGrid>
                )}

                {!isLoading && !hasContent && (
                    <Alert variant="light" color="gray" radius="md">
                        <Text ta="center" c="dimmed">{translate('pages.discovered.noResults')}</Text>
                    </Alert>
                )}

                {!isLoading && hasContent && (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {areas.map((area) => (
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
