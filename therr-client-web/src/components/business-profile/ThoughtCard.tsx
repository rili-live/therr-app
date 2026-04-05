import * as React from 'react';
import { Link } from 'react-router-dom';
import {
    Paper, Text, Group, Badge, Stack, Anchor,
} from '@mantine/core';
import { formatDate } from '../../utilities/formatDate';

interface IThoughtCardProps {
    locale: string;
    thought: any;
    onThoughtClick?: (thoughtId: string) => void;
}

const ThoughtCard: React.FC<IThoughtCardProps> = ({ locale, thought, onThoughtClick }) => {
    const hashTags = thought.hashTags ? thought.hashTags.split(',').filter(Boolean) : [];
    const thoughtUrl = `/thoughts/${thought.id}`;

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
                            {formatDate(thought.createdAt, locale)}
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
