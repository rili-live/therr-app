import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { ContentActions } from 'therr-react/redux/actions';
import {
    ActionIcon,
    Button,
    Container,
    Group,
    Paper,
    SimpleGrid,
    Skeleton,
    Stack,
    Text,
    ThemeIcon,
    Title,
} from '@mantine/core';
import useTranslation from '../../hooks/useTranslation';
import Tile from '../Discovered/Tile';

const BookmarkListDetail: React.FC = () => {
    const { t: translate } = useTranslation();
    const { listId } = useParams();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const activeUserList = useSelector((state: any) => state.content?.activeUserList);
    const user = useSelector((state: any) => state.user);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(() => {
        if (!listId) return;
        setIsLoading(true);
        dispatch(ContentActions.fetchUserList(listId) as any)
            .catch((err: any) => console.log(err))
            .finally(() => setIsLoading(false));
    }, [dispatch, listId]);

    useEffect(() => {
        document.title = `Therr | ${translate('pages.bookmarks.lists.title')}`;
        load();
    }, [load]); // eslint-disable-line

    const isActiveList = activeUserList && activeUserList.id === listId;
    const spaces = (isActiveList && activeUserList.spaces) || [];
    const hasContent = spaces.length > 0;

    const handleDelete = useCallback(async () => {
        if (!listId) return;
        // eslint-disable-next-line no-alert, no-restricted-globals
        if (!confirm(translate('pages.bookmarks.lists.deleteConfirm'))) return;
        try {
            await dispatch(ContentActions.deleteUserList(listId) as any);
            navigate('/bookmarks');
        } catch (_e) {
            // non-fatal
        }
    }, [listId, dispatch, navigate, translate]);

    return (
        <Container id="page_bookmark_list_detail" size="lg" py="xl">
            <Stack gap="lg">
                <Group justify="space-between" align="center">
                    <Group gap="sm" align="center">
                        <ActionIcon variant="subtle" onClick={() => navigate('/bookmarks')} aria-label={translate('pages.bookmarks.lists.back')}>
                            <Text size="xl">{'<'}</Text>
                        </ActionIcon>
                        <div>
                            <Title order={2}>{isActiveList ? activeUserList.name : translate('pages.bookmarks.lists.loading')}</Title>
                            {isActiveList && (
                                <Text size="sm" c="dimmed">
                                    {translate('pages.bookmarks.lists.itemCount', { count: activeUserList.itemCount ?? spaces.length })}
                                </Text>
                            )}
                        </div>
                    </Group>
                    {isActiveList && !activeUserList.isDefault && (
                        <Button variant="subtle" color="red" size="xs" onClick={handleDelete}>
                            {translate('pages.bookmarks.lists.deleteList')}
                        </Button>
                    )}
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
                        <Stack align="center" gap="md">
                            <ThemeIcon size={64} radius="xl" variant="light" color="teal">
                                <Text size="xl">{'*'}</Text>
                            </ThemeIcon>
                            <Text ta="center" c="dimmed">{translate('pages.bookmarks.lists.emptyList')}</Text>
                            <Button variant="light" onClick={() => navigate('/locations')}>
                                {translate('pages.bookmarks.lists.browseSpaces')}
                            </Button>
                        </Stack>
                    </Paper>
                )}

                {!isLoading && hasContent && (
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

export default BookmarkListDetail;
