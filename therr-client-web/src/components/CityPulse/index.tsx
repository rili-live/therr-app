/* eslint-disable max-len */
import * as React from 'react';
import { Link } from 'react-router-dom';
import {
    Stack, Group, Title, Text, Badge, Anchor, Paper, Image, SimpleGrid, Avatar, Button, Divider,
} from '@mantine/core';
import { Categories } from 'therr-js-utilities/constants';
import { buildSpaceSlug } from 'therr-js-utilities/slugify';
import getUserContentUri from '../../utilities/getUserContentUri';

// ──────────────────────────────────────────────────────────────────
// Shared helpers

const formatCategoryLabel = (category: string): string => {
    if (!category) return '';
    const label = category.replace('categories.', '').replace('/', ' & ');
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const paragraphsFromText = (text: string | null | undefined, limit = 4): string[] => {
    if (!text) return [];
    return text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean).slice(0, limit);
};

// Locale-stable event date formatter. Avoids `toLocaleString()` which produces
// different output on Node (SSR) vs the browser and triggers React hydration
// warnings. Format: "Apr 13, 2026 · 7:30 PM".
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatEventDate = (iso: string | null | undefined): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const hour24 = d.getUTCHours();
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    const ampm = hour24 < 12 ? 'AM' : 'PM';
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} · ${hour12}:${minutes} ${ampm}`;
};

export interface ICityPulseCity {
    slug: string;
    name: string;
    state: string;
    stateAbbr: string;
    lat: number;
    lng: number;
}

export interface ICityPulseWiki {
    summary: string | null;
    sections: {
        understand?: string;
        districts?: string;
        getIn?: string;
        getAround?: string;
    } | null;
    heroImageUrl: string | null;
    attributionUrl: string | null;
    license: string;
    localeFallback?: boolean;
}

export interface ICityPulseData {
    city: ICityPulseCity;
    therr: {
        trendingSpaces: any[];
        upcomingEvents: any[];
        recentMoments: any[];
        topGroups: any[];
        categoriesWithCounts: { categorySlug: string; count: number }[];
    };
    wiki: ICityPulseWiki;
    nearbyCities: { slug: string; name: string; stateAbbr: string; distanceKm: number }[];
}

interface ISectionProps {
    pulse: ICityPulseData;
    translate: (key: string, params?: any) => string;
}

// ──────────────────────────────────────────────────────────────────
// CityHero — always renders.

export const CityHero: React.FC<ISectionProps> = ({ pulse, translate }) => {
    const { city, wiki } = pulse;
    const displayName = `${city.name}, ${city.stateAbbr}`;
    const leadParagraph = wiki.summary ? wiki.summary.split(/(?<=[.!?])\s/).slice(0, 2).join(' ') : '';

    return (
        <Paper withBorder p="lg" radius="md">
            <Group align="flex-start" wrap="nowrap" gap="md">
                {wiki.heroImageUrl && (
                    <Image
                        src={wiki.heroImageUrl}
                        alt={displayName}
                        w={160}
                        h={120}
                        radius="md"
                        fit="cover"
                        style={{ flexShrink: 0 }}
                    />
                )}
                <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
                    <Title order={1} mb={0}>{translate('pages.cityPulse.heroTitle', { city: displayName })}</Title>
                    {leadParagraph ? (
                        <Text c="dimmed">{leadParagraph}</Text>
                    ) : (
                        <Text c="dimmed">{translate('pages.cityPulse.heroFallback', { city: displayName })}</Text>
                    )}
                </Stack>
            </Group>
        </Paper>
    );
};

// ──────────────────────────────────────────────────────────────────
// Wiki-sourced sections

export const CityAbout: React.FC<ISectionProps> = ({ pulse, translate }) => {
    const paragraphs = paragraphsFromText(pulse.wiki.sections?.understand, 4);
    if (!paragraphs.length) return null;
    return (
        <Stack gap="sm">
            <Title order={2}>{translate('pages.cityPulse.aboutHeading', { city: pulse.city.name })}</Title>
            {paragraphs.map((p, i) => (<Text key={i}>{p}</Text>))}
        </Stack>
    );
};

export const CityNeighborhoods: React.FC<ISectionProps> = ({ pulse, translate }) => {
    const paragraphs = paragraphsFromText(pulse.wiki.sections?.districts, 3);
    if (!paragraphs.length) return null;
    return (
        <Stack gap="sm">
            <Title order={2}>{translate('pages.cityPulse.neighborhoodsHeading')}</Title>
            {paragraphs.map((p, i) => (<Text key={i}>{p}</Text>))}
        </Stack>
    );
};

export const CityGettingAround: React.FC<ISectionProps> = ({ pulse, translate }) => {
    const getIn = paragraphsFromText(pulse.wiki.sections?.getIn, 2);
    const getAround = paragraphsFromText(pulse.wiki.sections?.getAround, 2);
    if (!getIn.length && !getAround.length) return null;
    return (
        <Stack gap="sm">
            <Title order={2}>{translate('pages.cityPulse.gettingAroundHeading')}</Title>
            {getIn.length > 0 && (
                <Stack gap={4}>
                    <Title order={3}>{translate('pages.cityPulse.getInSubheading')}</Title>
                    {getIn.map((p, i) => (<Text key={`in-${i}`}>{p}</Text>))}
                </Stack>
            )}
            {getAround.length > 0 && (
                <Stack gap={4}>
                    <Title order={3}>{translate('pages.cityPulse.getAroundSubheading')}</Title>
                    {getAround.map((p, i) => (<Text key={`around-${i}`}>{p}</Text>))}
                </Stack>
            )}
        </Stack>
    );
};

// ──────────────────────────────────────────────────────────────────
// Therr-sourced sections

export const CityTrendingSpaces: React.FC<ISectionProps> = ({ pulse, translate }) => {
    // Link `to` values are route-relative; React Router's <StaticRouter> /
    // <BrowserRouter> basename (set to the locale prefix in Layout) prepends
    // the locale automatically. Don't prepend localePrefix here — that would
    // double-prefix client-side navigation.
    const spaces = pulse.therr.trendingSpaces || [];
    if (spaces.length < 1) return null;
    return (
        <Stack gap="sm">
            <Title order={2}>{translate('pages.cityPulse.trendingSpacesHeading', { city: pulse.city.name })}</Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {spaces.slice(0, 12).map((space: any) => {
                    const mediaPath = space.medias?.[0]?.path;
                    const spaceImage = mediaPath ? getUserContentUri(space.medias[0], 80, 80, true) : null;
                    const slug = buildSpaceSlug(space.notificationMsg, space.addressLocality, space.addressRegion);
                    return (
                        <Paper key={space.id} withBorder p="md" radius="md">
                            <Group wrap="nowrap" align="flex-start" gap="sm">
                                {spaceImage ? (
                                    <Image src={spaceImage} alt={space.notificationMsg} w={56} h={56} radius="md" fit="cover" style={{ flexShrink: 0 }} />
                                ) : (
                                    <Avatar size={56} radius="md" color="teal">
                                        {(space.notificationMsg || '?').charAt(0).toUpperCase()}
                                    </Avatar>
                                )}
                                <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                                    <Anchor component={Link} to={`/spaces/${space.id}/${slug}`} fw={600}>
                                        {space.notificationMsg}
                                    </Anchor>
                                    {space.addressReadable && (
                                        <Text size="xs" c="dimmed" lineClamp={1}>{space.addressReadable}</Text>
                                    )}
                                    {space.category && (
                                        <Badge variant="outline" size="xs">{formatCategoryLabel(space.category)}</Badge>
                                    )}
                                </Stack>
                            </Group>
                        </Paper>
                    );
                })}
            </SimpleGrid>
            <Anchor component={Link} to={`/locations/city/${pulse.city.slug}/1`} size="sm">
                {translate('pages.cityPulse.browseAllSpacesLink', { city: pulse.city.name })}
            </Anchor>
        </Stack>
    );
};

export const CityUpcomingEvents: React.FC<ISectionProps> = ({ pulse, translate }) => {
    const events = pulse.therr.upcomingEvents || [];
    if (events.length < 1) return null;
    return (
        <Stack gap="sm">
            <Title order={2}>{translate('pages.cityPulse.upcomingEventsHeading', { city: pulse.city.name })}</Title>
            <Stack gap="xs">
                {events.slice(0, 8).map((event: any) => {
                    const dateLabel = formatEventDate(event.scheduleStartAt);
                    return (
                        <Paper key={event.id} withBorder p="md" radius="md">
                            <Anchor component={Link} to={`/events/${event.id}`} fw={600}>
                                {event.notificationMsg}
                            </Anchor>
                            {dateLabel && (
                                <Text size="sm" c="dimmed">{dateLabel}</Text>
                            )}
                        </Paper>
                    );
                })}
            </Stack>
        </Stack>
    );
};

export const CityMomentsWall: React.FC<ISectionProps> = ({ pulse, translate }) => {
    const moments = pulse.therr.recentMoments || [];
    if (moments.length < 4) return null;
    return (
        <Stack gap="sm">
            <Title order={2}>{translate('pages.cityPulse.momentsWallHeading', { city: pulse.city.name })}</Title>
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
                {moments.slice(0, 18).map((moment: any) => {
                    const mediaPath = moment.medias?.[0]?.path;
                    const img = mediaPath ? getUserContentUri(moment.medias[0], 200, 200, true) : null;
                    return (
                        <Anchor key={moment.id} component={Link} to={`/moments/${moment.id}`}>
                            {img ? (
                                <Image src={img} alt={moment.notificationMsg || 'moment'} h={120} fit="cover" radius="sm" />
                            ) : (
                                <Paper withBorder p="sm" radius="sm" h={120}>
                                    <Text size="xs" lineClamp={4}>{moment.notificationMsg}</Text>
                                </Paper>
                            )}
                        </Anchor>
                    );
                })}
            </SimpleGrid>
        </Stack>
    );
};

export const CityGroups: React.FC<ISectionProps> = ({ pulse, translate }) => {
    const groups = pulse.therr.topGroups || [];
    if (groups.length < 1) return null;
    return (
        <Stack gap="sm">
            <Title order={2}>{translate('pages.cityPulse.groupsHeading', { city: pulse.city.name })}</Title>
            <Stack gap="xs">
                {groups.slice(0, 6).map((group: any) => (
                    <Paper key={group.id} withBorder p="sm" radius="sm">
                        <Anchor component={Link} to={`/groups/${group.id}`}>{group.title}</Anchor>
                    </Paper>
                ))}
            </Stack>
        </Stack>
    );
};

// Popular category slugs shown as fallback tiles when a city has no counted
// categories yet. Keeps every city page internally linked for crawlers and
// useful for readers even before Therr has indexed local spaces.
const POPULAR_CATEGORY_FALLBACK: { urlSlug: string; label: string }[] = [
    { urlSlug: 'restaurants', label: 'Restaurants' },
    { urlSlug: 'bars', label: 'Bars' },
    { urlSlug: 'shops', label: 'Shops' },
    { urlSlug: 'hotels', label: 'Hotels' },
    { urlSlug: 'parks-nature', label: 'Parks & Nature' },
    { urlSlug: 'nightlife', label: 'Nightlife' },
    { urlSlug: 'music-concerts', label: 'Music & Concerts' },
    { urlSlug: 'art', label: 'Art' },
];

export const CityCategoryTiles: React.FC<ISectionProps> = ({ pulse, translate }) => {
    // Map backend category keys (e.g. "categories.restaurant/food") to URL slugs
    // ("restaurants") via the canonical CategorySlugMap. Skip categories without
    // a URL slug mapping so users never land on a 404 tile.
    const countedTiles = (pulse.therr.categoriesWithCounts || [])
        .map((cat) => ({
            key: cat.categorySlug,
            label: formatCategoryLabel(cat.categorySlug),
            countSuffix: ` (${cat.count})`,
            urlSlug: Categories.CategorySlugMap[cat.categorySlug],
        }))
        .filter((t) => !!t.urlSlug);

    // Fill with popular categories so the page always carries internal links.
    const usedSlugs = new Set(countedTiles.map((t) => t.urlSlug));
    const fallbackTiles = POPULAR_CATEGORY_FALLBACK
        .filter((t) => !usedSlugs.has(t.urlSlug))
        .map((t) => ({
            key: `popular-${t.urlSlug}`,
            label: t.label,
            countSuffix: '',
            urlSlug: t.urlSlug,
        }));

    const tiles = [...countedTiles, ...fallbackTiles];
    if (!tiles.length) return null;
    return (
        <Stack gap="sm">
            <Title order={2}>{translate('pages.cityPulse.browseByCategoryHeading', { city: pulse.city.name })}</Title>
            <Group gap="xs" wrap="wrap">
                {tiles.map((tile) => (
                    <Button
                        key={tile.key}
                        component={Link}
                        to={`/locations/city/${pulse.city.slug}/${tile.urlSlug}`}
                        variant="light"
                        size="sm"
                    >
                        {tile.label}
                        {tile.countSuffix}
                    </Button>
                ))}
            </Group>
        </Stack>
    );
};

// ──────────────────────────────────────────────────────────────────
// Computed/static sections

export const CityNearbyCities: React.FC<ISectionProps> = ({ pulse, translate }) => {
    const nearby = pulse.nearbyCities || [];
    if (!nearby.length) return null;
    return (
        <Stack gap="sm">
            <Title order={2}>{translate('pages.cityPulse.nearbyCitiesHeading')}</Title>
            <Group gap="sm" wrap="wrap">
                {nearby.map((c) => (
                    <Anchor
                        key={c.slug}
                        component={Link}
                        to={`/locations/city/${c.slug}`}
                    >
                        {c.name}, {c.stateAbbr}
                    </Anchor>
                ))}
            </Group>
        </Stack>
    );
};

export const CityCTA: React.FC<ISectionProps> = ({ pulse, translate }) => (
    <Paper withBorder p="lg" radius="md">
        <Stack gap="sm" align="center">
            <Title order={3} ta="center">{translate('pages.cityPulse.ctaHeading', { city: pulse.city.name })}</Title>
            <Text c="dimmed" ta="center" size="sm">{translate('pages.cityPulse.ctaBody')}</Text>
            <Group gap="xs" wrap="wrap" justify="center">
                <Anchor href="https://apps.apple.com/us/app/therr/id1569988763?platform=iphone" target="_blank" rel="noreferrer">
                    <Image maw={120} src="/assets/images/apple-store-download-button.svg" alt="Download Therr on the App Store" />
                </Anchor>
                <Anchor href="https://play.google.com/store/apps/details?id=app.therrmobile" target="_blank" rel="noreferrer">
                    <Image maw={120} src="/assets/images/play-store-download-button.svg" alt="Download Therr on Google Play" />
                </Anchor>
            </Group>
        </Stack>
    </Paper>
);

export const CityAttributionFooter: React.FC<ISectionProps> = ({ pulse, translate }) => {
    const { wiki } = pulse;
    const hasWikiContent = !!(wiki.summary || wiki.sections);
    if (!hasWikiContent) return null;
    return (
        <Paper p="md" radius="md" mt="md">
            <Divider mb="sm" />
            <Stack gap={4}>
                <Text size="xs" c="dimmed">
                    {translate('pages.cityPulse.attributionLead')}
                </Text>
                {wiki.attributionUrl && (
                    <Text size="xs" c="dimmed">
                        {translate('pages.cityPulse.attributionSource')}:
                        {' '}
                        <Anchor href={wiki.attributionUrl} target="_blank" rel="noreferrer">{wiki.attributionUrl}</Anchor>
                        {' '}·{' '}
                        <Anchor href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
                            CC BY-SA 4.0
                        </Anchor>
                    </Text>
                )}
                {wiki.localeFallback && (
                    <Text size="xs" c="dimmed">{translate('pages.cityPulse.attributionLocaleFallback')}</Text>
                )}
            </Stack>
        </Paper>
    );
};
