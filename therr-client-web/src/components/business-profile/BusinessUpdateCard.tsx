import * as React from 'react';
import {
    Paper, Text, Group, Badge, Stack,
} from '@mantine/core';

interface IBusinessUpdateCardProps {
    thought: any;
    onThoughtClick?: (thoughtId: string) => void;
}

const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const BusinessUpdateCard: React.FC<IBusinessUpdateCardProps> = ({ thought, onThoughtClick }) => {
    const hashTags = thought.hashTags ? thought.hashTags.split(',').filter(Boolean) : [];

    return (
        <Paper
            className={`business-update-card${onThoughtClick ? ' business-update-card-clickable' : ''}`}
            shadow="xs"
            radius="md"
            withBorder
            p="sm"
            onClick={onThoughtClick ? () => onThoughtClick(thought.id) : undefined}
            style={onThoughtClick ? { cursor: 'pointer' } : undefined}
        >
            <Stack gap="xs">
                <Group justify="space-between" align="center">
                    <Text size="xs" c="dimmed">
                        {formatDate(thought.createdAt)}
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
    );
};

export default BusinessUpdateCard;
