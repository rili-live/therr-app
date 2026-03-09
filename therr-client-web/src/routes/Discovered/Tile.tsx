import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ContentActions } from 'therr-react/redux/actions';
import { Content } from 'therr-js-utilities/constants';
import {
    ActionIcon,
    Badge,
    Card,
    Group,
    Image,
    Text,
    Tooltip,
} from '@mantine/core';
import { InlineSvg } from 'therr-react/components';
import getUserContentUri from '../../utilities/getUserContentUri';

interface ITileProps {
    area: any;
    areaType: string;
    userDetails: any;
}

const Tile: React.FC<ITileProps> = ({ area, areaType, userDetails }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const content = useSelector((state: any) => state.content);

    const isBookmarked = area.reaction?.userBookmarkCategory;
    const isLiked = area.reaction?.userHasLiked;

    const mediaPath = area.medias?.[0]?.path;
    const mediaType = area.medias?.[0]?.type;
    const mediaObj = area.medias?.[0];

    let imageUrl: string | undefined;
    if (mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC && mediaObj) {
        imageUrl = getUserContentUri(mediaObj, 480, 480, true);
    } else if (mediaPath) {
        imageUrl = content.media?.[mediaPath];
    }

    const isSpace = areaType === 'spaces';

    const onBookmarkPress = useCallback(() => {
        const reactionData: any = {
            userBookmarkCategory: area.reaction?.userBookmarkCategory ? null : 'Uncategorized',
        };
        if (isSpace) {
            reactionData.spaceId = area.id;
            dispatch(ContentActions.createOrUpdateSpaceReaction(area.id, reactionData, area.fromUserId, userDetails.userName) as any);
        } else {
            dispatch(ContentActions.createOrUpdateMomentReaction(area.id, reactionData, area.fromUserId, userDetails.userName) as any);
        }
    }, [dispatch, isSpace, area.id, area.reaction?.userBookmarkCategory, area.fromUserId, userDetails.userName]);

    const onLikePress = useCallback(() => {
        if (!area.isDraft) {
            const reactionData: any = {
                userHasLiked: !area.reaction?.userHasLiked,
            };
            if (isSpace) {
                reactionData.spaceId = area.id;
                dispatch(ContentActions.createOrUpdateSpaceReaction(area.id, reactionData, area.fromUserId, userDetails.userName) as any);
            } else {
                dispatch(ContentActions.createOrUpdateMomentReaction(area.id, reactionData, area.fromUserId, userDetails.userName) as any);
            }
        }
    }, [dispatch, isSpace, area.id, area.isDraft, area.reaction?.userHasLiked, area.fromUserId, userDetails.userName]);

    const handleCardClick = useCallback(() => {
        const route = areaType === 'spaces' ? `/spaces/${area.id}` : `/moments/${area.id}`;
        navigate(route);
    }, [navigate, areaType, area.id]);

    const typeLabel = areaType === 'spaces' ? 'Space' : 'Moment';

    return (
        <Card shadow="sm" padding={0} radius="md" withBorder className="discovered-tile">
            {imageUrl && (
                <Card.Section
                    onClick={handleCardClick}
                    style={{ cursor: 'pointer' }}
                >
                    <Image
                        src={imageUrl}
                        alt={area.notificationMsg || area.fromUserName}
                        height={200}
                        fit="cover"
                    />
                </Card.Section>
            )}

            <Card.Section p="sm">
                <Group justify="space-between" align="flex-start" wrap="nowrap" mb={4}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text
                            fw={600}
                            size="sm"
                            lineClamp={1}
                            onClick={handleCardClick}
                            style={{ cursor: 'pointer' }}
                        >
                            {area.notificationMsg || 'Untitled'}
                        </Text>
                        <Text size="xs" c="dimmed" lineClamp={1}>
                            {area.fromUserName}
                        </Text>
                    </div>
                    <Badge variant="light" size="xs" color={areaType === 'spaces' ? 'teal' : 'blue'}>
                        {typeLabel}
                    </Badge>
                </Group>

                {area.message && (
                    <Text size="xs" c="dimmed" lineClamp={2} mb="xs">
                        {area.message}
                    </Text>
                )}

                <Group gap="xs" justify="flex-end">
                    <Tooltip label={isLiked ? 'Unlike' : 'Like'}>
                        <ActionIcon
                            variant="subtle"
                            size="sm"
                            onClick={onLikePress}
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
                            onClick={onBookmarkPress}
                            color={isBookmarked ? 'dark' : 'gray'}
                        >
                            <InlineSvg
                                name={isBookmarked ? 'bookmark' : 'bookmark-border'}
                                className={`discovered-tile-icon ${isBookmarked ? 'discovered-tile-icon-bookmarked' : ''}`}
                            />
                        </ActionIcon>
                    </Tooltip>
                </Group>
            </Card.Section>
        </Card>
    );
};

export default Tile;
