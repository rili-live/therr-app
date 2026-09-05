import React, {
    useCallback, useEffect, useRef, useState,
} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ContentActions } from 'therr-react/redux/actions';
import { ReactionsService } from 'therr-react/services';
import { InlineSvg } from 'therr-react/components';
import {
    ActionIcon,
    Anchor,
    Badge,
    Breadcrumbs,
    Button,
    Container,
    Divider,
    Group,
    Image,
    Skeleton,
    Stack,
    Text,
    Textarea,
    Title,
    Tooltip,
} from '@mantine/core';
import { canRepostThought } from 'therr-js-utilities/content';
import UsersActions from '../redux/actions/UsersActions';
import useTranslation from '../hooks/useTranslation';
import EmbeddedThought from '../components/EmbeddedThought';
import RepostModal from '../components/RepostModal';
import { formatTimeAgo } from '../utilities/formatDate';
import getRepostErrorKey from '../utilities/repostErrors';
import getThoughtMediaUri from '../utilities/getThoughtMediaUri';

const ViewThought: React.FC = () => {
    const { t: translate, locale } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { thoughtId } = useParams<{ thoughtId: string }>();
    const user = useSelector((state: any) => state.user);
    const activeThoughts = useSelector((state: any) => state.content?.activeThoughts);

    const [thought, setThought] = useState<any>(null);
    const [replies, setReplies] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [replyMessage, setReplyMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [replyError, setReplyError] = useState('');
    // The thought the repost composer is open for (null when closed). The root thought and any
    // reply can each be reposted, so this holds the target rather than a plain boolean.
    const [repostTarget, setRepostTarget] = useState<any>(null);
    const [isReposting, setIsReposting] = useState(false);
    const [repostError, setRepostError] = useState('');
    const repliesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!thoughtId) {
            navigate('/posts/thoughts');
            return;
        }

        if (!user?.isAuthenticated) {
            setIsLoading(false);
            return;
        }

        // Get existing reaction data from the feed's Redux state
        const cachedThought = activeThoughts?.find((t: any) => t.id === thoughtId);

        setIsLoading(true);
        const tId: any = thoughtId;
        const detailsPromise = dispatch(UsersActions.getThoughtDetails(tId, {
            withUser: true,
            withReplies: true,
            withParent: true,
        }) as any);
        const reactionPromise = cachedThought?.reaction
            ? Promise.resolve(cachedThought.reaction)
            : ReactionsService.getThoughtReactions({ thoughtId: tId })
                .then((res: any) => {
                    const reactions = res?.data || [];
                    return reactions[0] || {};
                })
                .catch(() => ({}));

        Promise.all([detailsPromise, reactionPromise])
            .then(([response, reaction]: any) => {
                const fetchedThought = response?.thought || null;
                if (fetchedThought) {
                    fetchedThought.reaction = reaction;
                    fetchedThought.likeCount = fetchedThought.likeCount ?? cachedThought?.likeCount;
                }
                setThought(fetchedThought);
                setReplies(
                    fetchedThought?.replies?.sort(
                        (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
                    ) || [],
                );
                if (fetchedThought?.message) {
                    document.title = `${fetchedThought.message.substring(0, 60)} | Therr App`;
                }
            })
            .catch(() => {
                setThought(null);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [thoughtId, user?.isAuthenticated]); // eslint-disable-line

    const handleLike = useCallback((t: any) => {
        if (!t.isDraft) {
            dispatch(ContentActions.createOrUpdateThoughtReaction(
                t.id,
                { userHasLiked: !t.reaction?.userHasLiked },
                t.fromUserId,
                user?.details?.userName,
            ) as any);
            // Update local state for immediate feedback
            if (t.id === thought?.id) {
                setThought((prev: any) => ({
                    ...prev,
                    reaction: { ...prev?.reaction, userHasLiked: !prev?.reaction?.userHasLiked },
                }));
            } else {
                setReplies((prev) => prev.map((r) => (r.id === t.id
                    ? { ...r, reaction: { ...r.reaction, userHasLiked: !r.reaction?.userHasLiked } }
                    : r)));
            }
        }
    }, [dispatch, user?.details?.userName, thought?.id]);

    const handleBookmark = useCallback((t: any) => {
        const newCategory = t.reaction?.userBookmarkCategory ? null : 'Uncategorized';
        dispatch(ContentActions.createOrUpdateThoughtReaction(
            t.id,
            { userBookmarkCategory: newCategory } as any,
            t.fromUserId,
            user?.details?.userName,
        ) as any);
        if (t.id === thought?.id) {
            setThought((prev: any) => ({
                ...prev,
                reaction: { ...prev?.reaction, userBookmarkCategory: newCategory },
            }));
        }
    }, [dispatch, user?.details?.userName, thought?.id]);

    const handleSubmitReply = useCallback(() => {
        if (replyMessage.trim().length < 3) {
            setReplyError(translate('pages.viewThought.replyTooShort'));
            return;
        }

        const hashTags = replyMessage.match(/#[a-z0-9_]+/g) || [];
        const hashTagsString = [...new Set(hashTags.map((t) => t.replace(/#/g, '')))].join(',');

        setReplyError('');
        setIsSubmitting(true);

        dispatch(UsersActions.createThought({
            parentId: thoughtId,
            fromUserId: user.details.id,
            isPublic: false,
            message: replyMessage.trim(),
            hashTags: hashTagsString,
            isDraft: false,
        }) as any)
            .then((newReply: any) => {
                setReplies((prev) => [...prev, newReply]);
                setReplyMessage('');
                setTimeout(() => {
                    repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            })
            .catch(() => {
                setReplyError(translate('pages.viewThought.replyError'));
            })
            .finally(() => {
                setIsSubmitting(false);
            });
    }, [dispatch, replyMessage, thoughtId, user.details.id, translate]);

    const handleRepost = useCallback((t: any) => {
        setRepostError('');
        setRepostTarget(t);
    }, []);

    const handleRepostConfirm = useCallback((message: string) => {
        if (!repostTarget?.id) {
            return;
        }

        const targetId = repostTarget.id;
        // Hashtags come from the user's own quote only. Carrying the original's tags over would
        // put the reposter's account in feeds they never chose to post into.
        const hashTags = message.match(/#[a-z0-9_]+/g) || [];
        const hashTagsString = [...new Set(hashTags.map((t) => t.replace(/#/g, '')))].join(',');

        setRepostError('');
        setIsReposting(true);

        dispatch(UsersActions.createThought({
            fromUserId: user.details.id,
            // Reposting is a public act by definition — it surfaces the original to the
            // reposter's audience, so a private repost would be a no-op with a side effect.
            isPublic: true,
            message,
            hashTags: hashTagsString,
            repostThoughtId: targetId,
        }) as any)
            .then(() => {
                setRepostTarget(null);
                // The details endpoint is not re-fetched, so bump the count locally to keep the
                // control from rendering its pre-repost value for the rest of the visit.
                if (targetId === thought?.id) {
                    setThought((prev: any) => ({ ...prev, repostCount: (prev?.repostCount || 0) + 1 }));
                } else {
                    setReplies((prev) => prev.map((r) => (r.id === targetId
                        ? { ...r, repostCount: (r.repostCount || 0) + 1 }
                        : r)));
                }
            })
            .catch((err: any) => {
                setRepostError(translate(getRepostErrorKey(err?.statusCode)));
            })
            .finally(() => {
                setIsReposting(false);
            });
    }, [dispatch, repostTarget, user.details.id, thought?.id, translate]);

    const handleUserClick = useCallback((userId: string) => {
        navigate(`/users/${userId}`);
    }, [navigate]);

    // Drills into a reply's own details view, where its nested replies become the thread
    const handleInspectReply = useCallback((replyId: string) => {
        navigate(`/thoughts/${replyId}`);
    }, [navigate]);

    // Present only when the post being viewed is a reply
    const parentThought = thought?.parent;

    const breadcrumbs = [
        <Anchor component={Link} to="/" key="home" size="sm">{translate('pages.navigation.home')}</Anchor>,
        <Anchor component={Link} to="/posts/thoughts" key="thoughts" size="sm">{translate('pages.navigation.thoughts')}</Anchor>,
        ...(parentThought?.id
            ? [
                <Anchor component={Link} to={`/thoughts/${parentThought.id}`} key="parent" size="sm">
                    {translate('pages.viewThought.parentThread')}
                </Anchor>,
            ]
            : []),
        <Text size="sm" key="thought">
            {parentThought?.id
                ? translate('pages.viewThought.headerTitleReply')
                : translate('pages.viewThought.headerTitle')}
        </Text>,
    ];

    if (isLoading) {
        return (
            <Container id="page_view_thought" size="sm" py="xl">
                <Stack gap="md">
                    <Skeleton height={16} width="40%" />
                    <Skeleton height={120} radius="md" />
                    <Skeleton height={1} />
                    <Skeleton height={80} />
                    <Skeleton height={80} />
                </Stack>
            </Container>
        );
    }

    if (!thought) {
        if (!user?.isAuthenticated) {
            return (
                <Container id="page_view_thought" size="sm" py="xl">
                    <Stack gap="lg" align="center">
                        <Breadcrumbs>{breadcrumbs}</Breadcrumbs>
                        <Title order={3}>{translate('pages.viewThought.headerTitle')}</Title>
                        <Text ta="center" c="dimmed">
                            <Anchor component={Link} to="/login">{translate('pages.viewThought.loginToView')}</Anchor>
                        </Text>
                    </Stack>
                </Container>
            );
        }

        return null;
    }

    const hashtags = thought.hashTags ? thought.hashTags.split(',').filter(Boolean) : [];
    const isLiked = thought.reaction?.userHasLiked;
    const isBookmarked = thought.reaction?.userBookmarkCategory;

    return (
        <Container id="page_view_thought" size="sm" py="xl">
            <Stack gap="lg">
                <Breadcrumbs>{breadcrumbs}</Breadcrumbs>

                {/*
                    Thread context. Without it a reply renders exactly like a top-level thought,
                    so the post it answers — and the rest of the conversation — is invisible.
                */}
                {parentThought?.id && (
                    <Anchor
                        component={Link}
                        to={`/thoughts/${parentThought.id}`}
                        className="view-thought-parent"
                        underline="never"
                        aria-label={translate('pages.viewThought.viewParentThought')}
                    >
                        <Group gap="xs" align="center" mb={4} wrap="nowrap">
                            <InlineSvg name="forum" className="discovered-tile-icon" />
                            <Text size="xs" fw={700}>
                                {parentThought.fromUserName
                                    ? translate('pages.viewThought.replyingTo', { userName: parentThought.fromUserName })
                                    : translate('pages.viewThought.partOfThread')}
                            </Text>
                        </Group>
                        {parentThought.message && (
                            <Text size="sm" c="dimmed" lineClamp={2}>
                                {parentThought.message}
                            </Text>
                        )}
                    </Anchor>
                )}

                {/* Main thought */}
                <div className="view-thought-main">
                    {thought.isRepost && (
                        <Group gap={4} align="center" mb={4} className="thought-card-repost-attribution">
                            <InlineSvg name="repeat" className="discovered-tile-icon" />
                            <Text size="xs" c="dimmed" fw={600}>
                                {translate('pages.exploreThoughts.repostedBy', {
                                    userName: thought.fromUserName || thought.fromUserFirstName || '',
                                })}
                            </Text>
                        </Group>
                    )}
                    <Group gap="xs" align="center" mb={4}>
                        <Text
                            fw={700}
                            size="sm"
                            onClick={() => handleUserClick(thought.fromUserId)}
                            className="thought-card-username"
                        >
                            {thought.fromUserName || thought.fromUserFirstName}
                        </Text>
                        <Text size="xs" c="dimmed">
                            {thought.createdAt && formatTimeAgo(thought.createdAt, locale, translate)}
                        </Text>
                    </Group>

                    <Text size="md" mb="sm" className="thought-card-message">
                        {thought.message}
                    </Text>

                    {getThoughtMediaUri(thought) && (
                        <Image
                            src={getThoughtMediaUri(thought)}
                            alt=""
                            radius="md"
                            mb="sm"
                            fit="contain"
                        />
                    )}

                    {thought.isRepost && <EmbeddedThought repostOf={thought.repostOf} />}

                    {hashtags.length > 0 && (
                        <Group gap={6} mb="sm" wrap="wrap">
                            {hashtags.map((tag: string) => (
                                <Badge key={tag} variant="light" size="xs" color="blue">
                                    #{tag.trim()}
                                </Badge>
                            ))}
                        </Group>
                    )}

                    <Group gap="md" className="thought-card-reactions">
                        {user?.isAuthenticated && (
                            <Tooltip label={isLiked ? 'Unlike' : 'Like'}>
                                <ActionIcon
                                    variant="subtle"
                                    size="sm"
                                    onClick={() => handleLike(thought)}
                                    color={isLiked ? 'red' : 'gray'}
                                >
                                    <InlineSvg
                                        name={isLiked ? 'favorite' : 'favorite-border'}
                                        className={`discovered-tile-icon ${isLiked ? 'discovered-tile-icon-liked' : ''}`}
                                    />
                                </ActionIcon>
                            </Tooltip>
                        )}
                        {user?.isAuthenticated && (
                            <Tooltip label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}>
                                <ActionIcon
                                    variant="subtle"
                                    size="sm"
                                    onClick={() => handleBookmark(thought)}
                                    color={isBookmarked ? 'dark' : 'gray'}
                                >
                                    <InlineSvg
                                        name={isBookmarked ? 'bookmark' : 'bookmark-border'}
                                        className={`discovered-tile-icon ${isBookmarked ? 'discovered-tile-icon-bookmarked' : ''}`}
                                    />
                                </ActionIcon>
                            </Tooltip>
                        )}
                        {user?.isAuthenticated && canRepostThought(thought, user.details.id) && (
                            <Tooltip label={translate('pages.exploreThoughts.repostThought')}>
                                <Button
                                    variant="subtle"
                                    size="compact-xs"
                                    color="gray"
                                    aria-label={translate('pages.exploreThoughts.repostThought')}
                                    onClick={() => handleRepost(thought)}
                                    leftSection={(
                                        <InlineSvg name="repeat" className="discovered-tile-icon" />
                                    )}
                                    className="thought-card-repost-count"
                                >
                                    {thought.repostCount || ''}
                                </Button>
                            </Tooltip>
                        )}
                    </Group>
                </div>

                <Divider />

                {/* Replies section */}
                <div className="view-thought-replies">
                    <Title order={4} mb="md">
                        {replies.length > 0
                            ? `${replies.length} ${replies.length === 1
                                ? translate('pages.viewThought.reply')
                                : translate('pages.viewThought.replies')}`
                            : translate('pages.viewThought.noReplies')}
                    </Title>

                    {replies.length > 0 && (
                        <Stack gap={0}>
                            {replies.map((reply) => {
                                const replyHashtags = reply.hashTags ? reply.hashTags.split(',').filter(Boolean) : [];
                                const replyIsLiked = reply.reaction?.userHasLiked;
                                const replyReplyCount = reply.replyCount || 0;
                                const viewRepliesLabel = translate('pages.viewThought.viewReplies', { count: replyReplyCount });
                                return (
                                    <div key={reply.id} className="thought-card">
                                        <div className="thought-card-content">
                                            <Group gap="xs" align="center" mb={4}>
                                                <Text
                                                    fw={700}
                                                    size="sm"
                                                    onClick={() => handleUserClick(reply.fromUserId)}
                                                    className="thought-card-username"
                                                >
                                                    {reply.fromUserName || reply.fromUserFirstName || user.details.userName}
                                                </Text>
                                                <Text size="xs" c="dimmed">
                                                    {reply.createdAt && formatTimeAgo(reply.createdAt, locale, translate)}
                                                </Text>
                                            </Group>

                                            <Text size="sm" mb="xs" className="thought-card-message">
                                                {reply.message}
                                            </Text>

                                            {replyHashtags.length > 0 && (
                                                <Group gap={6} mb="xs" wrap="wrap">
                                                    {replyHashtags.map((tag: string) => (
                                                        <Badge key={tag} variant="light" size="xs" color="blue">
                                                            #{tag.trim()}
                                                        </Badge>
                                                    ))}
                                                </Group>
                                            )}

                                            <Group gap="md" className="thought-card-reactions">
                                                {user?.isAuthenticated && (
                                                    <Tooltip label={replyIsLiked ? 'Unlike' : 'Like'}>
                                                        <ActionIcon
                                                            variant="subtle"
                                                            size="sm"
                                                            onClick={() => handleLike(reply)}
                                                            color={replyIsLiked ? 'red' : 'gray'}
                                                        >
                                                            <InlineSvg
                                                                name={replyIsLiked ? 'favorite' : 'favorite-border'}
                                                                className={`discovered-tile-icon ${replyIsLiked ? 'discovered-tile-icon-liked' : ''}`}
                                                            />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                )}
                                                {user?.isAuthenticated && canRepostThought(reply, user.details.id) && (
                                                    <Tooltip label={translate('pages.exploreThoughts.repostThought')}>
                                                        <Button
                                                            variant="subtle"
                                                            size="compact-xs"
                                                            color="gray"
                                                            aria-label={translate('pages.exploreThoughts.repostThought')}
                                                            onClick={() => handleRepost(reply)}
                                                            leftSection={(
                                                                <InlineSvg name="repeat" className="discovered-tile-icon" />
                                                            )}
                                                            className="thought-card-repost-count"
                                                        >
                                                            {reply.repostCount || ''}
                                                        </Button>
                                                    </Tooltip>
                                                )}
                                                <Tooltip label={viewRepliesLabel}>
                                                    <Button
                                                        variant="subtle"
                                                        size="compact-xs"
                                                        color="gray"
                                                        aria-label={viewRepliesLabel}
                                                        onClick={() => handleInspectReply(reply.id)}
                                                        leftSection={(
                                                            <InlineSvg name="forum" className="discovered-tile-icon" />
                                                        )}
                                                        className="thought-card-reply-count"
                                                    >
                                                        {replyReplyCount}
                                                    </Button>
                                                </Tooltip>
                                            </Group>
                                        </div>
                                    </div>
                                );
                            })}
                        </Stack>
                    )}
                    <div ref={repliesEndRef} />
                </div>

                {/* Reply input */}
                {user?.isAuthenticated && (
                    <div className="view-thought-reply-input">
                        <Textarea
                            placeholder={translate('pages.viewThought.replyPlaceholder')}
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.currentTarget.value)}
                            minRows={2}
                            maxRows={4}
                            maxLength={255}
                            autosize
                        />
                        <Group justify="space-between" mt="xs" align="center">
                            <Text size="xs" c="dimmed">{replyMessage.length}/255</Text>
                            <Button
                                size="xs"
                                onClick={handleSubmitReply}
                                loading={isSubmitting}
                                disabled={replyMessage.trim().length < 3}
                            >
                                {translate('pages.viewThought.replyButton')}
                            </Button>
                        </Group>
                        {replyError && (
                            <Text size="xs" c="red" mt="xs">{replyError}</Text>
                        )}
                    </div>
                )}

                {!user?.isAuthenticated && (
                    <Text ta="center" size="sm" c="dimmed">
                        <Anchor component={Link} to="/login">{translate('pages.viewThought.loginToReply')}</Anchor>
                    </Text>
                )}

                <RepostModal
                    thought={repostTarget}
                    isSubmitting={isReposting}
                    error={repostError}
                    onClose={() => setRepostTarget(null)}
                    onConfirm={handleRepostConfirm}
                />

                {/* Back buttons */}
                <Group gap="sm">
                    {parentThought?.id && (
                        <Button
                            variant="outline"
                            onClick={() => navigate(`/thoughts/${parentThought.id}`)}
                            size="sm"
                        >
                            {translate('pages.viewThought.backToParent')}
                        </Button>
                    )}
                    <Button
                        variant={parentThought?.id ? 'subtle' : 'outline'}
                        onClick={() => navigate('/posts/thoughts')}
                        size="sm"
                    >
                        {translate('pages.viewThought.backToThoughts')}
                    </Button>
                </Group>
            </Stack>
        </Container>
    );
};

export default ViewThought;
