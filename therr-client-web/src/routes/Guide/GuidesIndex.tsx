/* eslint-disable max-len */
import * as React from 'react';
import { useParams } from 'react-router-dom';
import {
    Anchor, Badge, Container, Group, Paper, Stack, Text, Title,
} from '@mantine/core';
import {
    getPublishedGuides, getGuidesByCity, getGuidesByCategory, IPost,
} from '../../utilities/guideContent';
import withTranslation from '../../wrappers/withTranslation';

interface IProps {
    locale: string;
    translate: (key: string, params?: any) => string;
    /** When set, narrows the index by city or category (driven by the route). */
    filterMode?: 'city' | 'category';
}

function localePrefix(locale: string): string {
    if (locale === 'es' || locale === 'fr-ca') return `/${locale}`;
    return '';
}

const GuideTeaser: React.FC<{ post: IPost; locale: string }> = ({ post, locale }) => {
    const prefix = localePrefix(locale);
    return (
        <Paper p="md" withBorder>
            <Stack gap="xs">
                <Group justify="space-between" align="flex-start">
                    <Title order={3} size="h4">
                        <Anchor href={`${prefix}/guides/${post.slug}`}>{post.title}</Anchor>
                    </Title>
                    <Badge variant="light" size="sm">{post.type}</Badge>
                </Group>
                <Text size="sm" c="dimmed">{post.description}</Text>
                <Group gap="xs">
                    {post.city && <Badge variant="outline" size="xs">{post.city}</Badge>}
                    {post.category && <Badge variant="outline" size="xs">{post.category}</Badge>}
                    <Text size="xs" c="dimmed">{post.publishedAt}</Text>
                </Group>
            </Stack>
        </Paper>
    );
};

const GuidesIndex: React.FC<IProps> = ({ locale, filterMode }) => {
    const params = useParams<{ citySlug?: string; categorySlug?: string }>();
    let posts: IPost[];
    let pageTitle = 'Local Guides';
    let pageDescription = 'Editorial guides and data-driven posts about local businesses, neighborhoods, and what people actually do in your city.';

    if (filterMode === 'city' && params.citySlug) {
        posts = getGuidesByCity(params.citySlug);
        pageTitle = `Guides for ${params.citySlug}`;
        pageDescription = `Local business guides and data posts for ${params.citySlug}.`;
    } else if (filterMode === 'category' && params.categorySlug) {
        posts = getGuidesByCategory(params.categorySlug);
        pageTitle = `Guides — ${params.categorySlug}`;
        pageDescription = `Local guides and data posts in the ${params.categorySlug} category.`;
    } else {
        posts = getPublishedGuides();
    }

    return (
        <Container size="md" py="xl">
            <Stack gap="lg">
                <Stack gap="xs">
                    <Title order={1}>{pageTitle}</Title>
                    <Text c="dimmed">{pageDescription}</Text>
                </Stack>
                {posts.length === 0
                    ? <Text c="dimmed">No guides published yet. Check back soon.</Text>
                    : (
                        <Stack gap="md">
                            {posts.map((p) => <GuideTeaser key={p.slug} post={p} locale={locale} />)}
                        </Stack>
                    )}
            </Stack>
        </Container>
    );
};

export default withTranslation(GuidesIndex);
