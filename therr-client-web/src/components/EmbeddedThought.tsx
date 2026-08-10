import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Group, Text } from '@mantine/core';
import getUserImageUri from '../utilities/getUserImageUri';
import useTranslation from '../hooks/useTranslation';
import { formatTimeAgo } from '../utilities/formatDate';

interface IEmbeddedThoughtProps {
    /**
     * The original thought a repost points at, as returned in `repostOf`. Null whenever the
     * original was deleted, mature-flagged, or falls outside the reader's brand — the backend
     * resolves all three to the same "no embed" answer.
     */
    repostOf: any;
    /**
     * Whether the embed navigates to the original on click. Must be false when the embed is
     * rendered inside an `<a>` (the profile card): stopping React's synthetic event does not
     * stop the browser following the enclosing anchor, so a "clickable" embed there would
     * still navigate to the repost.
     */
    isInteractive?: boolean;
}

/**
 * The original post rendered inside a repost. Mirrors `RepostEmbed` in
 * `TherrMobile/main/components/UserContent/ThoughtDisplay.tsx`.
 *
 * Clicks are stopped from bubbling: the embed sits inside a card that navigates to the
 * *repost*, and a reader tapping the quoted post means to open the original.
 */
const EmbeddedThought: React.FC<IEmbeddedThoughtProps> = ({ repostOf, isInteractive = true }) => {
    const navigate = useNavigate();
    const { t: translate, locale } = useTranslation();

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (!isInteractive) {
            return;
        }
        e.stopPropagation();
        if (repostOf?.id) {
            navigate(`/thoughts/${repostOf.id}`);
        }
    }, [isInteractive, navigate, repostOf?.id]);

    const handleUserClick = useCallback((e: React.MouseEvent) => {
        if (!isInteractive) {
            return;
        }
        e.stopPropagation();
        if (repostOf?.fromUserId) {
            navigate(`/users/${repostOf.fromUserId}`);
        }
    }, [isInteractive, navigate, repostOf?.fromUserId]);

    if (!repostOf) {
        return (
            <div className="thought-card-repost-embed thought-card-repost-embed-unavailable">
                <Text size="sm" c="dimmed" fs="italic">
                    {translate('pages.exploreThoughts.repostUnavailable')}
                </Text>
            </div>
        );
    }

    return (
        <div
            className={`thought-card-repost-embed${isInteractive ? ' thought-card-repost-embed-clickable' : ''}`}
            onClick={handleClick}
        >
            <Group gap="xs" align="center" mb={4}>
                <Avatar
                    src={getUserImageUri({ details: { media: repostOf.fromUserMedia, id: repostOf.fromUserId } }, 32)}
                    alt={repostOf.fromUserName || ''}
                    size={22}
                    radius="xl"
                    onClick={handleUserClick}
                    className={isInteractive ? 'thought-card-thread-preview-avatar' : undefined}
                />
                <Text
                    fw={600}
                    size="xs"
                    onClick={handleUserClick}
                    className={isInteractive ? 'thought-card-username' : undefined}
                >
                    {repostOf.fromUserName}
                </Text>
                <Text size="xs" c="dimmed">
                    {repostOf.createdAt && formatTimeAgo(repostOf.createdAt, locale)}
                </Text>
            </Group>
            <Text size="sm" className="thought-card-repost-embed-message">
                {repostOf.message}
            </Text>
        </div>
    );
};

export default EmbeddedThought;
