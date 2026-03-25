import * as React from 'react';
import {
    Paper, Text, Group, Badge, Stack,
} from '@mantine/core';

interface IBusinessEventCardProps {
    event: any;
    spaceName?: string;
}

const formatEventDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const BusinessEventCard: React.FC<IBusinessEventCardProps> = ({ event, spaceName }) => {
    const startDate = formatEventDate(event.scheduleStartAt);
    const endDate = formatEventDate(event.scheduleStopAt);

    return (
        <Paper className="business-event-card" shadow="xs" radius="md" withBorder p="sm">
            <Stack gap="xs">
                <Group justify="space-between" align="flex-start">
                    <Text fw={600} size="md" lineClamp={1} style={{ flex: 1 }}>
                        {event.notificationMsg || event.message}
                    </Text>
                    {event.category && (
                        <Badge variant="light" size="sm">
                            {event.category}
                        </Badge>
                    )}
                </Group>
                <Group gap="xs">
                    {startDate && (
                        <Text size="sm" c="dimmed">
                            {startDate}
                            {endDate ? ` - ${endDate}` : ''}
                        </Text>
                    )}
                </Group>
                {spaceName && (
                    <Text size="xs" c="dimmed">
                        {spaceName}
                    </Text>
                )}
                {event.message && event.message !== event.notificationMsg && (
                    <Text size="sm" lineClamp={2}>
                        {event.message}
                    </Text>
                )}
            </Stack>
        </Paper>
    );
};

export default BusinessEventCard;
