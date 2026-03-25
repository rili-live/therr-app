import * as React from 'react';
import {
    Paper, Image, Text, Group, Badge, Anchor, Stack,
} from '@mantine/core';
import { MantineButton } from 'therr-react/components/mantine';

interface IBusinessSpaceCardProps {
    space: any;
    translate: (key: string, params?: any) => string;
    onSpaceClick?: (spaceId: string) => void;
    onEditClick?: (spaceId: string) => void;
}

const BusinessSpaceCard: React.FC<IBusinessSpaceCardProps> = ({
    space, translate, onSpaceClick, onEditClick,
}) => {
    const mediaUrl = space.media?.[0]?.path || '';
    const handleClick = () => {
        if (onSpaceClick) {
            onSpaceClick(space.id);
        }
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onEditClick) {
            onEditClick(space.id);
        }
    };

    return (
        <Paper
            className="business-space-card"
            shadow="sm"
            radius="md"
            withBorder
            onClick={handleClick}
            style={{ cursor: onSpaceClick ? 'pointer' : 'default' }}
        >
            {mediaUrl && (
                <Image
                    src={mediaUrl}
                    height={160}
                    alt={space.notificationMsg || ''}
                    radius="md"
                    fallbackSrc="https://placehold.co/400x160?text=No+Image"
                    style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
                />
            )}
            <Stack gap="xs" p="sm">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Text fw={600} size="lg" lineClamp={1} style={{ flex: 1 }}>
                        {space.notificationMsg || space.message}
                    </Text>
                    {onEditClick && (
                        <MantineButton
                            id={`edit_space_${space.id}`}
                            text={translate('pages.userProfile.buttons.editSpace')}
                            onClick={handleEditClick}
                            variant="subtle"
                            size="xs"
                        />
                    )}
                </Group>
                {space.addressReadable && (
                    <Text size="sm" c="dimmed" lineClamp={2}>
                        {space.addressReadable}
                    </Text>
                )}
                {space.category && (
                    <Badge variant="light" size="sm" w="fit-content">
                        {space.category}
                    </Badge>
                )}
                <Group gap="xs" wrap="wrap">
                    {space.websiteUrl && (
                        <Anchor
                            href={space.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="xs"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {translate('pages.viewSpace.labels.website')}
                        </Anchor>
                    )}
                    {space.phoneNumber && (
                        <Anchor
                            href={`tel:${space.phoneNumber}`}
                            size="xs"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {translate('pages.viewSpace.labels.phone')}
                        </Anchor>
                    )}
                    {space.menuUrl && (
                        <Anchor
                            href={space.menuUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="xs"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {translate('pages.viewSpace.labels.menu')}
                        </Anchor>
                    )}
                </Group>
            </Stack>
        </Paper>
    );
};

export default BusinessSpaceCard;
