import * as React from 'react';
import { Link } from 'react-router-dom';
import {
    Paper, Text, Group, Badge, Stack, Anchor, Image,
} from '@mantine/core';
import { formatDate } from '../../utilities/formatDate';
import EmbeddedThought from '../EmbeddedThought';
import useTranslation from '../../hooks/useTranslation';
import getThoughtMediaUri from '../../utilities/getThoughtMediaUri';

interface IThoughtCardProps {
    locale: string;
    thought: any;
    onThoughtClick?: (thoughtId: string) => void;
}

const ThoughtCard: React.FC<IThoughtCardProps> = ({ locale, thought, onThoughtClick }) => {
    const { t: translate } = useTranslation();
    const hashTags = thought.hashTags ? thought.hashTags.split(',').filter(Boolean) : [];
    const thoughtUrl = `/thoughts/${thought.id}`;
    const mediaUri = getThoughtMediaUri(thought, 400, 400);

    const handleClick = (e: React.MouseEvent) => {
        if (onThoughtClick) {
            e.preventDefault();
            onThoughtClick(thought.id);
        }
    };

    return (
        <Anchor
            component={Link}
            to={thoughtUrl}
            underline="never"
            c="inherit"
            onClick={handleClick}
            aria-label={(thought.message || '').substring(0, 80) || undefined}
        >
            <Paper
                className="thought-card"
                shadow="xs"
                radius="md"
                withBorder
                p="sm"
                style={{ cursor: 'pointer' }}
            >
                <Stack gap="xs">
                    <Group justify="space-between" align="center">
                        <Text size="xs" c="dimmed">
                            {thought.isRepost
                                ? translate('pages.exploreThoughts.repostedBy', { userName: thought.fromUserName || '' })
                                : formatDate(thought.createdAt, locale)}
                        </Text>
                        {thought.category && (
                            <Badge variant="light" size="sm">
                                {thought.category}
                            </Badge>
                        )}
                    </Group>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }} lineClamp={4}>
                        {thought.message}
                    </Text>
                    {mediaUri && (
                        <Image
                            src={mediaUri}
                            alt=""
                            radius="sm"
                            h={180}
                            fit="cover"
                            loading="lazy"
                        />
                    )}
                    {/*
                        A plain repost has an empty message, so without the embed this card would
                        render as a blank tile on the author's profile. Non-interactive because the
                        whole card is an <a>: stopping React's synthetic event does not stop the
                        browser following the enclosing anchor.
                    */}
                    {thought.isRepost && <EmbeddedThought repostOf={thought.repostOf} isInteractive={false} />}
                    {hashTags.length > 0 && (
                        <Group gap={4} wrap="wrap">
                            {hashTags.slice(0, 5).map((tag: string) => (
                                <Badge key={tag} variant="outline" size="xs">
                                    #{tag.trim()}
                                </Badge>
                            ))}
                        </Group>
                    )}
                </Stack>
            </Paper>
        </Anchor>
    );
};

export default ThoughtCard;
