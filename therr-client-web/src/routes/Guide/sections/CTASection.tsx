import * as React from 'react';
import {
    Anchor, Button, Group, Paper, Stack, Text, Title,
} from '@mantine/core';

interface IProps {
    heading: string;
    body: string;
    href?: string;
    ctaText?: string;
}

const CTASection: React.FC<IProps> = ({
    heading, body, href, ctaText,
}) => (
    <Paper p="lg" withBorder>
        <Stack gap="md">
            <Title order={2} size="h3">{heading}</Title>
            <Text>{body}</Text>
            {href && (
                <Group>
                    <Anchor href={href}>
                        <Button variant="filled">{ctaText || 'Learn more'}</Button>
                    </Anchor>
                </Group>
            )}
        </Stack>
    </Paper>
);

export default CTASection;
