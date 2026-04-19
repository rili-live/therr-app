import * as React from 'react';
import {
    Paper, Stack, Text, Title,
} from '@mantine/core';

interface IProps {
    stat: string;
    statLabel: string;
    body?: string;
}

const DataCalloutSection: React.FC<IProps> = ({ stat, statLabel, body }) => (
    <Paper p="lg" withBorder bg="var(--mantine-color-default-hover)">
        <Stack gap="xs" align="center">
            <Title order={2} size="h1">{stat}</Title>
            <Text size="md" fw={500} ta="center">{statLabel}</Text>
            {body && <Text size="sm" c="dimmed" ta="center">{body}</Text>}
        </Stack>
    </Paper>
);

export default DataCalloutSection;
