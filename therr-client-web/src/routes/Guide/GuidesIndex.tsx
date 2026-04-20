/* eslint-disable max-len */
import * as React from 'react';
import { useParams } from 'react-router-dom';
import {
    Anchor, Badge, Container, Group, Paper, Stack, Text, Title,
} from '@mantine/core';
import { Categories, Cities } from 'therr-js-utilities/constants';
import {
    getPublishedGuides, getGuidesByCity, getGuidesByCategory, getGuidesByHashtag, IPost,
} from '../../utilities/guideContent';
import withTranslation from '../../wrappers/withTranslation';

interface IProps {
    locale: string;
    translate: (key: string, params?: any) => string;
    /** When set, narrows the index by city, category, or hashtag (driven by the route). */
    filterMode?: 'city' | 'category' | 'hashtag';
}

// URL prefix matches the canonical route (server 301s /fr-ca/* → /fr/*);
// see prefixToLocale in server-client.tsx and localePrefixMap in Header/Home/etc.
const LOCALE_URL_PREFIX: Record<string, string> = { es: '/es', 'fr-ca': '/fr' };

function localePrefix(locale: string): string {
    return LOCALE_URL_PREFIX[locale] || '';
}

function cityLabelFromSlug(slug: string): string {
    return Cities.CitySlugMap[slug]?.name || slug;
}

function categoryLabelFromKey(key: string): string {
    const label = key.replace('categories.', '').replace('/', ' & ');
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function categoryLabelFromSlug(slug: string): string {
    const key = Categories.SlugToCategoryMap[slug];
    return key ? categoryLabelFromKey(key) : slug;
}

function hashtagLabel(tag: string): string {
    const spaced = tag.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    return spaced
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
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
                    {post.city && <Badge variant="outline" size="xs">{cityLabelFromSlug(post.city)}</Badge>}
                    {post.category && <Badge variant="outline" size="xs">{categoryLabelFromKey(post.category)}</Badge>}
                    {post.hashtag && <Badge variant="outline" size="xs">{`#${post.hashtag}`}</Badge>}
                    <Text size="xs" c="dimmed">{post.publishedAt}</Text>
                </Group>
            </Stack>
        </Paper>
    );
};

const GuidesIndex: React.FC<IProps> = ({ locale, filterMode }) => {
    const params = useParams<{ citySlug?: string; categorySlug?: string; hashtag?: string }>();
    let posts: IPost[];
    let pageTitle = 'Local Guides';
    let pageDescription = 'Editorial guides and data-driven posts about local businesses, neighborhoods, and what people actually do in your city.';

    if (filterMode === 'city' && params.citySlug) {
        posts = getGuidesByCity(params.citySlug);
        const cityLabel = cityLabelFromSlug(params.citySlug);
        pageTitle = `Guides for ${cityLabel}`;
        pageDescription = `Local business guides and data posts for ${cityLabel}.`;
    } else if (filterMode === 'category' && params.categorySlug) {
        posts = getGuidesByCategory(params.categorySlug);
        const categoryLabel = categoryLabelFromSlug(params.categorySlug);
        pageTitle = `Guides — ${categoryLabel}`;
        pageDescription = `Local guides and data posts in the ${categoryLabel.toLowerCase()} category.`;
    } else if (filterMode === 'hashtag' && params.hashtag) {
        posts = getGuidesByHashtag(params.hashtag);
        const tagLabel = hashtagLabel(params.hashtag);
        pageTitle = `Guides — ${tagLabel}`;
        pageDescription = `Local guides tagged ${tagLabel.toLowerCase()}.`;
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
