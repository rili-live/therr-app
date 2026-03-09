import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ContentActions } from 'therr-react/redux/actions';
import { InlineSvg } from 'therr-react/components';
import {
    ActionIcon,
    Anchor,
    Badge,
    Breadcrumbs,
    Container,
    Group,
    Skeleton,
    Stack,
    Text,
    Title,
    Alert,
    Button,
    Tooltip,
} from '@mantine/core';
import translator from '../../services/translator';

const translate = (key: string, params?: any) => translator('en-us', key, params);

const formatTimeAgo = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHr < 24) return `${diffHr}h`;
    if (diffDay < 7) return `${diffDay}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface IThoughtCardProps {
    thought: any;
    onLike: (thought: any) => void;
    onBookmark: (thought: any) => void;
}

const ThoughtCard: React.FC<IThoughtCardProps> = ({
    thought, onLike, onBookmark,
}) => {
    const navigate = useNavigate();
    const isLiked = thought.reaction?.userHasLiked;
    const isBookmarked = thought.reaction?.userBookmarkCategory;
    const hashtags = thought.hashTags ? thought.hashTags.split(',').filter(Boolean) : [];

    const handleUserClick = useCallback(() => {
        navigate(`/users/${thought.fromUserId}`);
    }, [navigate, thought.fromUserId]);

    return (
        <div className="thought-card">
            <div className="thought-card-content">
                <Group gap="xs" align="center" mb={4}>
                    <Text
                        fw={700}
                        size="sm"
                        onClick={handleUserClick}
                        className="thought-card-username"
                    >
                        {thought.fromUserName}
                    </Text>
                    <Text size="xs" c="dimmed">
                        {thought.createdAt && formatTimeAgo(thought.createdAt)}
                    </Text>
                </Group>

                <Text size="sm" mb="xs" className="thought-card-message">
                    {thought.message}
                </Text>

                {hashtags.length > 0 && (
                    <Group gap={6} mb="xs" wrap="wrap">
                        {hashtags.slice(0, 6).map((tag: string) => (
                            <Badge
                                key={tag}
                                variant="light"
                                size="xs"
                                color="blue"
                                className="thought-card-hashtag"
                            >
                                #{tag.trim()}
                            </Badge>
                        ))}
                        {hashtags.length > 6 && (
                            <Text size="xs" c="dimmed">+{hashtags.length - 6}</Text>
                        )}
                    </Group>
                )}

                <Group gap="md" className="thought-card-reactions">
                    <Tooltip label={isLiked ? 'Unlike' : 'Like'}>
                        <ActionIcon
                            variant="subtle"
                            size="sm"
                            onClick={() => onLike(thought)}
                            color={isLiked ? 'red' : 'gray'}
                        >
                            <InlineSvg
                                name={isLiked ? 'favorite' : 'favorite-border'}
                                className={`discovered-tile-icon ${isLiked ? 'discovered-tile-icon-liked' : ''}`}
                            />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}>
                        <ActionIcon
                            variant="subtle"
                            size="sm"
                            onClick={() => onBookmark(thought)}
                            color={isBookmarked ? 'dark' : 'gray'}
                        >
                            <InlineSvg
                                name={isBookmarked ? 'bookmark' : 'bookmark-border'}
                                className={`discovered-tile-icon ${isBookmarked ? 'discovered-tile-icon-bookmarked' : ''}`}
                            />
                        </ActionIcon>
                    </Tooltip>
                </Group>
            </div>
        </div>
    );
};

const ExploreThoughts: React.FC = () => {
    const dispatch = useDispatch();
    const content = useSelector((state: any) => state.content);
    const user = useSelector((state: any) => state.user);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const fetchThoughts = useCallback((offset = 0, isRefresh = true) => {
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
            return dispatch(ContentActions.updateActiveThoughtsStream(params) as any)
                .catch((err) => console.log(err))
                .finally(() => setIsLoading(false));
        }

        setIsLoadingMore(true);
        return dispatch(ContentActions.searchActiveThoughts(params) as any)
            .catch((err) => console.log(err))
            .finally(() => setIsLoadingMore(false));
    }, [dispatch, content.activeAreasFilters, user.details.blockedUsers, user.details.shouldHideMatureContent]);

    useEffect(() => {
        document.title = `Therr | ${translate('pages.exploreThoughts.pageTitle')}`;
        fetchThoughts(0, true);
    }, []); // eslint-disable-line

    const thoughts = content.activeThoughts || [];
    const hasContent = thoughts.length > 0;
    const pagination = content.activeThoughtsPagination;
    const hasMore = pagination && thoughts.length < (pagination.totalResults || 0);

    const handleLoadMore = () => {
        fetchThoughts(thoughts.length, false);
    };

    const handleLike = useCallback((thought: any) => {
        if (!thought.isDraft) {
            dispatch(ContentActions.createOrUpdateThoughtReaction(
                thought.id,
                { userHasLiked: !thought.reaction?.userHasLiked },
                thought.fromUserId,
                user?.details?.userName,
            ) as any);
        }
    }, [dispatch, user?.details?.userName]);

    const handleBookmark = useCallback((thought: any) => {
        dispatch(ContentActions.createOrUpdateThoughtReaction(
            thought.id,
            { userBookmarkCategory: thought.reaction?.userBookmarkCategory ? null : 'Uncategorized' } as any,
            thought.fromUserId,
            user?.details?.userName,
        ) as any);
    }, [dispatch, user?.details?.userName]);

    const breadcrumbs = [
        <Anchor component={Link} to="/" key="home" size="sm">Home</Anchor>,
        <Anchor component={Link} to="/explore" key="explore" size="sm">Explore</Anchor>,
        <Text size="sm" key="thoughts">Thoughts</Text>,
    ];

    return (
        <Container id="page_explore_thoughts" size="sm" py="xl">
            <Stack gap="lg">
                <Breadcrumbs>{breadcrumbs}</Breadcrumbs>

                <div>
                    <Title order={2}>{translate('pages.exploreThoughts.pageTitle')}</Title>
                    <Text size="sm" c="dimmed">{translate('pages.exploreThoughts.subtitle')}</Text>
                </div>

                {isLoading && (
                    <Stack gap="md">
                        {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} height={120} radius="md" />
                        ))}
                    </Stack>
                )}

                {!isLoading && !hasContent && (
                    <Alert variant="light" color="gray" radius="md">
                        <Text ta="center" c="dimmed">{translate('pages.exploreThoughts.noResults')}</Text>
                    </Alert>
                )}

                {!isLoading && hasContent && (
                    <>
                        <Stack gap={0}>
                            {thoughts.map((thought: any) => (
                                <ThoughtCard
                                    key={thought.id}
                                    thought={thought}
                                    onLike={handleLike}
                                    onBookmark={handleBookmark}
                                />
                            ))}
                        </Stack>
                        {hasMore && (
                            <Group justify="center">
                                <Button
                                    variant="outline"
                                    onClick={handleLoadMore}
                                    loading={isLoadingMore}
                                >
                                    {translate('pages.exploreThoughts.loadMore')}
                                </Button>
                            </Group>
                        )}
                    </>
                )}
            </Stack>
        </Container>
    );
};

export default ExploreThoughts;
