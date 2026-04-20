/* eslint-disable max-len */
import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    Anchor, Badge, Container, Divider, Group, Image, Stack, Text, Title,
} from '@mantine/core';
import { buildSpaceSlug } from 'therr-js-utilities/slugify';
import {
    getGuide, IPost, IPostSection, resolveGuideForLocale,
} from '../../utilities/guideContent';
import withTranslation from '../../wrappers/withTranslation';
import ProseSection from './sections/ProseSection';
import SpaceListSection from './sections/SpaceListSection';
import DataCalloutSection from './sections/DataCalloutSection';
import DataTableSection from './sections/DataTableSection';
import FAQSection from './sections/FAQSection';
import CTASection from './sections/CTASection';
import WalkableRoute from './sections/WalkableRoute';
import PageNotFound from '../PageNotFound';

interface IGuideProps {
    locale: string;
    translate: (key: string, params?: any) => string;
}

// URL prefix matches the canonical route (server 301s /fr-ca/* → /fr/*);
// see prefixToLocale in server-client.tsx and localePrefixMap in Header/Home/etc.
const LOCALE_URL_PREFIX: Record<string, string> = { es: '/es', 'fr-ca': '/fr' };

function localePrefix(locale: string): string {
    return LOCALE_URL_PREFIX[locale] || '';
}

// Prepend the locale prefix to an internal absolute path (starting with /)
// that isn't already prefixed. External URLs and already-prefixed paths pass through.
function prefixInternalHref(href: string | undefined, prefix: string): string | undefined {
    if (!href || !prefix) return href;
    if (!href.startsWith('/')) return href;
    if (href.startsWith(`${prefix}/`) || href === prefix) return href;
    if (href.startsWith('/es/') || href.startsWith('/fr/') || href === '/es' || href === '/fr') return href;
    return `${prefix}${href}`;
}

function buildSpaceHref(locale: string, spaceId: string, slug?: string): string {
    const prefix = localePrefix(locale);
    return slug ? `${prefix}/spaces/${spaceId}/${slug}` : `${prefix}/spaces/${spaceId}`;
}

function renderSection(
    section: IPostSection,
    idx: number,
    ctx: { locale: string; spaceMeta?: Record<string, { name: string; slug?: string }> },
): React.ReactNode {
    switch (section.type) {
        case 'prose':
            return <ProseSection key={idx} body={section.body} />;
        case 'space-list':
            return (
                <SpaceListSection
                    key={idx}
                    items={section.items}
                    spaceMeta={ctx.spaceMeta}
                    buildSpaceHref={(id, slug) => buildSpaceHref(ctx.locale, id, slug)}
                />
            );
        case 'data-callout':
            return <DataCalloutSection key={idx} stat={section.stat} statLabel={section.statLabel} body={section.body} />;
        case 'data-table':
            return <DataTableSection key={idx} caption={section.caption} headers={section.headers} rows={section.rows} />;
        case 'faq':
            return <FAQSection key={idx} items={section.items} />;
        case 'cta':
            return (
                <CTASection
                    key={idx}
                    heading={section.heading}
                    body={section.body}
                    href={prefixInternalHref(section.href, localePrefix(ctx.locale))}
                    ctaText={section.ctaText}
                />
            );
        case 'walkable-route':
            return (
                <WalkableRoute
                    key={idx}
                    centroid={section.centroid}
                    totalMeters={section.totalMeters}
                    estimatedMinutes={section.estimatedMinutes}
                    stops={section.stops}
                    localePrefix={localePrefix(ctx.locale)}
                    buildSpaceHref={(id, slug) => buildSpaceHref(ctx.locale, id, slug)}
                    spaceMeta={ctx.spaceMeta}
                />
            );
        default:
            return null;
    }
}

const formatPublished = (iso: string) => {
    if (!iso) return '';
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

const Guide: React.FC<IGuideProps> = ({ locale }) => {
    const params = useParams<{ slug: string }>();
    const slug = params.slug || '';
    const post: IPost | null = slug ? getGuide(slug) : null;
    const mapSpaces = useSelector((state: any) => state.map?.spaces || {});

    if (!post || post.status !== 'published') return <PageNotFound />;

    const resolved = resolveGuideForLocale(post, locale);
    const prefix = localePrefix(locale);

    const spaceMeta: Record<string, { name: string; slug?: string }> = {};
    Object.keys(mapSpaces).forEach((id) => {
        const s = mapSpaces[id];
        if (!s?.notificationMsg) return;
        spaceMeta[id] = {
            name: s.notificationMsg,
            slug: buildSpaceSlug(s.notificationMsg, s.locality, s.region),
        };
    });

    return (
        <Container size="md" py="xl">
            <Stack gap="lg">
                <Stack gap="xs">
                    <Group gap="xs">
                        <Anchor href={`${prefix}/guides`} size="sm">Guides</Anchor>
                        {post.city && (
                            <>
                                <Text size="sm" c="dimmed">/</Text>
                                <Anchor href={`${prefix}/guides/city/${post.city}`} size="sm">{post.city}</Anchor>
                            </>
                        )}
                    </Group>
                    <Title order={1}>{resolved.title}</Title>
                    <Group gap="md" align="center">
                        <Text size="sm" c="dimmed">
                            By {post.authorUrl ? <Anchor href={post.authorUrl}>{post.author}</Anchor> : post.author}
                        </Text>
                        <Text size="sm" c="dimmed">·</Text>
                        <Text size="sm" c="dimmed">Published {formatPublished(post.publishedAt)}</Text>
                        {post.updatedAt && post.updatedAt !== post.publishedAt && (
                            <>
                                <Text size="sm" c="dimmed">·</Text>
                                <Text size="sm" c="dimmed">Updated {formatPublished(post.updatedAt)}</Text>
                            </>
                        )}
                        {post.category && <Badge variant="light">{post.category}</Badge>}
                    </Group>
                </Stack>

                {post.heroImage && (
                    <Image src={post.heroImage.url} alt={post.heroImage.alt} radius="md" />
                )}

                <Text size="lg" fw={500}>{resolved.lead}</Text>

                <Divider />

                <Stack gap="xl">
                    {resolved.sections.map((s, i) => renderSection(s, i, { locale, spaceMeta }))}
                </Stack>
            </Stack>
        </Container>
    );
};

export default withTranslation(Guide);
