import * as React from 'react';
import {
    Anchor, Badge, Group, Paper, Stack, Text, Title,
} from '@mantine/core';
import { ISpaceListItem } from '../../../utilities/guideContent';

interface IProps {
    items: ISpaceListItem[];
    /** Optional map of spaceId → resolved space metadata (name, slug). When absent we render IDs. */
    spaceMeta?: Record<string, { name: string; slug?: string }>;
    /** Locale-prefix-aware path builder for space links. */
    buildSpaceHref: (spaceId: string, slug?: string) => string;
}

const SpaceListSection: React.FC<IProps> = ({ items, spaceMeta, buildSpaceHref }) => (
    <Stack gap="md">
        {items.map((item) => {
            const meta = spaceMeta?.[item.spaceId];
            const name = meta?.name || item.spaceId;
            const href = buildSpaceHref(item.spaceId, meta?.slug);
            return (
                <Paper key={item.spaceId} p="md" withBorder>
                    <Stack gap="xs">
                        <Group gap="sm" align="baseline">
                            <Badge size="lg" variant="filled">#{item.rank}</Badge>
                            <Title order={3} size="h4">
                                <Anchor href={href}>{name}</Anchor>
                            </Title>
                        </Group>
                        {item.reason && (
                            <Text c="dimmed" size="sm" fw={500}>{item.reason}</Text>
                        )}
                        <Text size="md">{item.blurb}</Text>
                    </Stack>
                </Paper>
            );
        })}
    </Stack>
);

export default SpaceListSection;
