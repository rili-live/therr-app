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
    Button,
    Container,
    Group,
    NativeSelect,
    Skeleton,
    Stack,
    Switch,
    Text,
    Textarea,
    TextInput,
    Title,
    Alert,
    Tooltip,
} from '@mantine/core';
import { Categories } from 'therr-js-utilities/constants';
import { toIntlLocale } from '../../utilities/formatDate';
import UsersActions from '../../redux/actions/UsersActions';
import useTranslation from '../../hooks/useTranslation';

const categoryOptions = Categories.ThoughtCategories.map((cat: string) => {
    const label = cat.replace('categories.', '').replace('/', ' / ');
    return { value: cat, label: label.charAt(0).toUpperCase() + label.slice(1) };
});

const categoryLabelMap: Record<string, string> = {};
categoryOptions.forEach((opt) => { categoryLabelMap[opt.value] = opt.label; });

const formatTimeAgo = (dateStr: string, locale: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHr < 24) return `${diffHr}h`;
    if (diffDay < 7) return `${diffDay}d`;
    return date.toLocaleDateString(toIntlLocale(locale), { month: 'short', day: 'numeric' });
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
    const { locale } = useTranslation();
    const isLiked = thought.reaction?.userHasLiked;
    const isBookmarked = thought.reaction?.userBookmarkCategory;
    const hashtags = thought.hashTags ? thought.hashTags.split(',').filter(Boolean) : [];

    const handleUserClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        navigate(`/users/${thought.fromUserId}`);
    }, [navigate, thought.fromUserId]);

    const handleCardClick = useCallback(() => {
        navigate(`/thoughts/${thought.id}`);
    }, [navigate, thought.id]);

    return (
        <div className="thought-card thought-card-clickable" onClick={handleCardClick}>
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
                        {thought.createdAt && formatTimeAgo(thought.createdAt, locale)}
                    </Text>
                    {thought.category && categoryLabelMap[thought.category] && (
                        <Text size="xs" c="dimmed" className="thought-card-category">
                            {categoryLabelMap[thought.category]}
                        </Text>
                    )}
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

                <Group gap="md" className="thought-card-reactions" onClick={(e) => e.stopPropagation()}>
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

interface IComposeThoughtProps {
    onSuccess: () => void;
}

const formatHashtags = (value: string, hashtagsClone: string[]): { formattedValue: string; formattedHashtags: string[] } => {
    const lastCharacter = value.substring(value.length - 1, value.length);
    let modifiedValue = value.replace(/[^\w_]/gi, '');

    if (lastCharacter === ',' || lastCharacter === ' ') {
        const tag = modifiedValue;
        if (tag !== '' && hashtagsClone.length < 50 && !hashtagsClone.includes(tag)) {
            hashtagsClone.push(tag);
        }
        modifiedValue = '';
    }

    return {
        formattedValue: modifiedValue,
        formattedHashtags: hashtagsClone,
    };
};

const ComposeThought: React.FC<IComposeThoughtProps> = ({ onSuccess }) => {
    const { t: translate } = useTranslation();
    const dispatch = useDispatch();
    const user = useSelector((state: any) => state.user);
    const [message, setMessage] = useState('');
    const [hashTagInput, setHashTagInput] = useState('');
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [category, setCategory] = useState(categoryOptions[0]?.value || '');
    const [isPublic, setIsPublic] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleHashTagChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.currentTarget.value;
        const { formattedValue, formattedHashtags } = formatHashtags(value, [...hashtags]);
        setHashTagInput(formattedValue);
        setHashtags(formattedHashtags);
    }, [hashtags]);

    const handleHashTagBlur = useCallback(() => {
        if (hashTagInput.trim().length) {
            const { formattedValue, formattedHashtags } = formatHashtags(`${hashTagInput},`, [...hashtags]);
            setHashTagInput(formattedValue);
            setHashtags(formattedHashtags);
        }
    }, [hashTagInput, hashtags]);

    const handleHashTagRemove = useCallback((tag: string) => {
        setHashtags((prev) => prev.filter((t) => t !== tag));
    }, []);

    const handleSubmit = useCallback(() => {
        if (message.trim().length < 3) {
            setError(translate('pages.exploreThoughts.messageTooShort'));
            return;
        }

        // Finalize any in-progress hashtag input
        const finalHashtags = [...hashtags];
        if (hashTagInput.trim().length) {
            const tag = hashTagInput.replace(/[^\w_]/gi, '');
            if (tag && !finalHashtags.includes(tag)) {
                finalHashtags.push(tag);
            }
        }

        setError('');
        setIsSubmitting(true);

        const createArgs = {
            fromUserId: user.details.id,
            message: message.trim(),
            hashTags: finalHashtags.join(','),
            category,
            isPublic,
            locale: user.details.locale || 'en-us',
        };

        dispatch(UsersActions.createThought(createArgs) as any)
            .then(
                () => {
                    setMessage('');
                    setHashTagInput('');
                    setHashtags([]);
                    setCategory(categoryOptions[0]?.value || '');
                    setIsPublic(true);
                    setIsSubmitting(false);
                    onSuccess();
                },
                (err: any) => {
                    console.error('createThought error:', err); // eslint-disable-line no-console
                    setError(translate('pages.exploreThoughts.postError'));
                    setIsSubmitting(false);
                },
            );
    }, [dispatch, message, hashTagInput, hashtags, category, isPublic, user.details.id, user.details.locale, onSuccess]);

    if (!user?.isAuthenticated) {
        return (
            <Alert variant="light" color="blue" radius="md">
                <Text ta="center" size="sm">
                    <Anchor component={Link} to="/login">{translate('pages.exploreThoughts.loginToPost')}</Anchor>
                </Text>
            </Alert>
        );
    }

    return (
        <div className="compose-thought">
            <Textarea
                placeholder={translate('pages.exploreThoughts.composePlaceholder')}
                value={message}
                onChange={(e) => setMessage(e.currentTarget.value)}
                minRows={2}
                maxRows={6}
                maxLength={255}
                autosize
            />
            <TextInput
                placeholder={translate('pages.exploreThoughts.hashtagsPlaceholder')}
                value={hashTagInput}
                onChange={handleHashTagChange}
                onBlur={handleHashTagBlur}
                mt="xs"
            />
            {hashtags.length > 0 && (
                <Group gap={6} mt="xs" wrap="wrap">
                    {hashtags.map((tag) => (
                        <Badge
                            key={tag}
                            variant="light"
                            size="sm"
                            color="blue"
                            className="compose-thought-hashtag"
                            rightSection={
                                <ActionIcon
                                    variant="transparent"
                                    size={14}
                                    onClick={() => handleHashTagRemove(tag)}
                                    color="blue"
                                >
                                    x
                                </ActionIcon>
                            }
                        >
                            #{tag}
                        </Badge>
                    ))}
                </Group>
            )}
            <Group justify="space-between" mt="xs" align="center">
                <Group gap="sm">
                    <NativeSelect
                        data={categoryOptions}
                        value={category}
                        onChange={(e) => setCategory(e.currentTarget.value)}
                        size="xs"
                    />
                    <Switch
                        label={isPublic
                            ? translate('pages.exploreThoughts.visibilityPublic')
                            : translate('pages.exploreThoughts.visibilityPrivate')}
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.currentTarget.checked)}
                        size="xs"
                    />
                </Group>
                <Group gap="xs">
                    <Text size="xs" c="dimmed">{message.length}/255</Text>
                    <Button
                        size="xs"
                        onClick={handleSubmit}
                        loading={isSubmitting}
                        disabled={message.trim().length < 3}
                    >
                        {translate('pages.exploreThoughts.postButton')}
                    </Button>
                </Group>
            </Group>
            {error && (
                <Text size="xs" c="red" mt="xs">{error}</Text>
            )}
        </div>
    );
};

const ITEMS_PER_PAGE = 30;

const ExploreThoughts: React.FC = () => {
    const { t: translate } = useTranslation();
    const dispatch = useDispatch();
    const content = useSelector((state: any) => state.content);
    const user = useSelector((state: any) => state.user);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchThoughts = useCallback((page = 1) => {
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
        return dispatch(ContentActions.updateActiveThoughtsStream(params, ITEMS_PER_PAGE) as any)
            .catch((err) => console.log(err))
            .finally(() => setIsLoading(false));
    }, [dispatch, content.activeAreasFilters, user.details.blockedUsers, user.details.shouldHideMatureContent]);

    useEffect(() => {
        document.title = `Therr | ${translate('pages.exploreThoughts.pageTitle')}`;
        fetchThoughts(1);
    }, []); // eslint-disable-line

    const thoughts = content.activeThoughts || [];
    const hasContent = thoughts.length > 0;
    const pagination = content.activeThoughtsPagination;
    const isLastPage = pagination?.isLastPage !== false && thoughts.length < ITEMS_PER_PAGE;
    const hasPrev = currentPage > 1;
    const hasNext = !isLastPage;

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        fetchThoughts(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

    const handlePostSuccess = useCallback(() => {
        setCurrentPage(1);
        fetchThoughts(1);
    }, [fetchThoughts]);

    const breadcrumbs = [
        <Anchor component={Link} to="/" key="home" size="sm">{translate('pages.navigation.home')}</Anchor>,
        <Anchor component={Link} to="/explore" key="explore" size="sm">{translate('pages.navigation.explore')}</Anchor>,
        <Text size="sm" key="thoughts">{translate('pages.navigation.thoughts')}</Text>,
    ];

    return (
        <Container id="page_explore_thoughts" size="sm" py="xl">
            <Stack gap="lg">
                <Breadcrumbs>{breadcrumbs}</Breadcrumbs>

                <div>
                    <Title order={2}>{translate('pages.exploreThoughts.pageTitle')}</Title>
                    <Text size="sm" c="dimmed">{translate('pages.exploreThoughts.subtitle')}</Text>
                </div>

                <ComposeThought onSuccess={handlePostSuccess} />

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

export default ExploreThoughts;
