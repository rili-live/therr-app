import * as React from 'react';
import {
    Paper, Text, Group, Badge, Stack,
} from '@mantine/core';
import { formatEventDate } from '../../utilities/formatDate';

interface IBusinessEventCardProps {
    locale: string;
    event: any;
    spaceName?: string;
}

const BusinessEventCard: React.FC<IBusinessEventCardProps> = ({ locale, event, spaceName }) => {
    const startDate = formatEventDate(event.scheduleStartAt, locale);
    const endDate = formatEventDate(event.scheduleStopAt, locale);

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
