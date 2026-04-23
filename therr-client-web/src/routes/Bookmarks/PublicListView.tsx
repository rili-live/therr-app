import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { ContentActions } from 'therr-react/redux/actions';
import {
    Alert,
    Button,
    Container,
    Group,
    Paper,
    SimpleGrid,
    Skeleton,
    Stack,
    Text,
    Title,
} from '@mantine/core';
import useTranslation from '../../hooks/useTranslation';
import Tile from '../Discovered/Tile';

// Read-only public list page. Fetched via the auth-optional
// /user-lists/public/:ownerUserId/:listSlug endpoint; populates the shared
// `activeUserList` Redux slice so SSR preload and client render match.
const PublicListView: React.FC = () => {
    const { t: translate } = useTranslation();
    const { ownerUserId, listSlug } = useParams();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const activeUserList = useSelector((state: any) => state.content?.activeUserList);
    const user = useSelector((state: any) => state.user);
    const [isLoading, setIsLoading] = useState(() => {
        // If SSR already populated the matching list, render immediately.
        if (typeof window === 'undefined') return false;
        return !(activeUserList
            && activeUserList.isPublic
            && activeUserList.userId === ownerUserId);
    });
    const [notFound, setNotFound] = useState(false);

    const load = useCallback(() => {
        if (!ownerUserId || !listSlug) return;
        setIsLoading(true);
        setNotFound(false);
        dispatch(ContentActions.fetchPublicUserList(ownerUserId, listSlug) as any)
            .catch(() => { setNotFound(true); })
            .finally(() => setIsLoading(false));
    }, [dispatch, ownerUserId, listSlug]);

    useEffect(() => {
        const alreadyHydrated = activeUserList
            && activeUserList.isPublic
            && activeUserList.userId === ownerUserId;
        if (!alreadyHydrated) {
            load();
        }
    }, [load]); // eslint-disable-line

    const list = (activeUserList && activeUserList.userId === ownerUserId) ? activeUserList : null;
    const spaces = (list && list.spaces) || [];
    const hasContent = spaces.length > 0;
    const isAuthed = !!user?.isAuthenticated;

    return (
        <Container id="page_public_list_view" size="lg" py="xl">
            <Stack gap="lg">
                <Group justify="space-between" align="flex-start" wrap="wrap">
                    <Stack gap={4} style={{ flex: 1, minWidth: 240 }}>
                        <Title order={1} size="h2">
                            {list?.name || translate('pages.publicList.loadingTitle')}
                        </Title>
                        {list && (
                            <Text size="sm" c="dimmed">
                                {translate('pages.publicList.itemCount', { count: list.itemCount ?? spaces.length })}
                            </Text>
                        )}
                        {list?.description && (
                            <Text size="sm" style={{ maxWidth: 720 }}>{list.description}</Text>
                        )}
                    </Stack>
                    {!isAuthed && (
                        <Button variant="filled" onClick={() => navigate('/go-mobile')}>
                            {translate('pages.publicList.openInApp')}
                        </Button>
                    )}
                </Group>

                {notFound && (
                    <Alert color="red" variant="light" title={translate('pages.publicList.notFoundTitle')}>
                        {translate('pages.publicList.notFoundBody')}
                    </Alert>
                )}

                {isLoading && !notFound && (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Skeleton key={i} height={280} radius="md" />
                        ))}
                    </SimpleGrid>
                )}

                {!isLoading && !notFound && !hasContent && (
                    <Paper withBorder p="xl" radius="md">
                        <Stack align="center" gap="md">
                            <Text ta="center" c="dimmed">{translate('pages.publicList.emptyList')}</Text>
                        </Stack>
                    </Paper>
                )}

                {!isLoading && !notFound && hasContent && (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {spaces.map((space: any) => (
                            <Tile
                                key={space.id}
                                area={{ ...space, areaType: 'spaces' }}
                                areaType="spaces"
                                userDetails={user.details}
                            />
                        ))}
                    </SimpleGrid>
                )}
            </Stack>
        </Container>
    );
};

export default PublicListView;
