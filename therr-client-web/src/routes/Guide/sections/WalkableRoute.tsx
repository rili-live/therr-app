/* eslint-disable max-len */
import * as React from 'react';
import {
    Anchor, Badge, Group, Paper, Stack, Text, Title,
} from '@mantine/core';
import type { IWalkableRouteStop } from '../../../utilities/guideContent';
import SpacesMap from '../../../components/SpacesMap';

interface IProps {
    centroid: { lat: number; lng: number };
    totalMeters: number;
    estimatedMinutes: number;
    stops: IWalkableRouteStop[];
    localePrefix: string;
    buildSpaceHref: (spaceId: string, slug?: string) => string;
    spaceMeta?: Record<string, { name: string; slug?: string }>;
}

const formatKm = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
};

const WalkableRoute: React.FC<IProps> = ({
    centroid,
    totalMeters,
    estimatedMinutes,
    stops,
    localePrefix,
    buildSpaceHref,
    spaceMeta,
}) => {
    const ordered = [...stops].sort((a, b) => a.order - b.order);
    const mapSpaces = ordered.map((stop) => ({
        id: stop.spaceId,
        notificationMsg: spaceMeta?.[stop.spaceId]?.name || stop.name,
        latitude: stop.lat,
        longitude: stop.lng,
    }));

    return (
        <Stack gap="md">
            <Group gap="md" wrap="wrap">
                <Badge size="lg" variant="light" color="blue">
                    {formatKm(totalMeters)} total
                </Badge>
                <Badge size="lg" variant="light" color="blue">
                    ~{estimatedMinutes} min walk
                </Badge>
                <Badge size="lg" variant="light" color="gray">
                    {ordered.length} stops
                </Badge>
            </Group>

            <Stack gap="sm">
                {ordered.map((stop, idx) => {
                    const meta = spaceMeta?.[stop.spaceId];
                    const displayName = meta?.name || stop.name;
                    const href = buildSpaceHref(stop.spaceId, meta?.slug);
                    return (
                        <React.Fragment key={stop.spaceId}>
                            {idx > 0 && stop.walkFromPreviousMeters != null && (
                                <Group gap="xs" pl="md">
                                    <Text size="xs" c="dimmed">
                                        ↓ walk {formatKm(stop.walkFromPreviousMeters)}
                                    </Text>
                                </Group>
                            )}
                            <Paper p="md" withBorder>
                                <Stack gap="xs">
                                    <Group gap="sm" align="baseline">
                                        <Badge size="lg" variant="filled" color="blue">
                                            Stop {stop.order}
                                        </Badge>
                                        <Title order={3} size="h4">
                                            <Anchor href={href}>{displayName}</Anchor>
                                        </Title>
                                    </Group>
                                    {stop.note && (
                                        <Text size="md">{stop.note}</Text>
                                    )}
                                </Stack>
                            </Paper>
                        </React.Fragment>
                    );
                })}
            </Stack>

            <SpacesMap
                spaces={mapSpaces}
                centerLat={centroid.lat}
                centerLng={centroid.lng}
                localePrefix={localePrefix}
                height={360}
                interactive
            />
        </Stack>
    );
};

export default WalkableRoute;
