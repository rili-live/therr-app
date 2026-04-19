/* eslint-disable max-len */
import type { IPost, IPostSection, IResolvedPost } from './guideContent';

const SITE_ORIGIN = 'https://www.therr.com';

interface IBuildArgs {
    post: IPost;
    resolved: IResolvedPost;
    canonicalPath: string;
    spaceMeta?: Record<string, { name: string; slug?: string }>;
}

export interface IGuideSchemas {
    articleSchema: string;
    breadcrumbSchema: string;
    itemListSchema: string;
    faqSchema: string;
    touristTripSchema: string;
}

const escapeForJsonLd = (input: any): string => JSON.stringify(input);

function humanizeHashtag(tag: string): string {
    return tag
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

const buildArticle = ({ post, resolved, canonicalPath }: IBuildArgs) => {
    const article: any = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: resolved.title,
        description: resolved.description,
        url: `${SITE_ORIGIN}${canonicalPath}`,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt || post.publishedAt,
        author: {
            '@type': 'Organization',
            name: post.author || 'Therr',
            ...(post.authorUrl ? { url: post.authorUrl } : {}),
        },
        publisher: {
            '@type': 'Organization',
            name: 'Therr',
            logo: {
                '@type': 'ImageObject',
                url: `${SITE_ORIGIN}/assets/images/meta-image-logo.png`,
            },
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `${SITE_ORIGIN}${canonicalPath}`,
        },
    };
    if (post.heroImage?.url) {
        article.image = post.heroImage.url;
    }
    if (post.hashtag) {
        article.keywords = post.hashtag;
    }
    return article;
};

const buildBreadcrumb = ({ post, resolved, canonicalPath }: IBuildArgs) => {
    const items: any[] = [
        {
            '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/`,
        },
        {
            '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE_ORIGIN}/guides`,
        },
    ];
    if (post.city) {
        items.push({
            '@type': 'ListItem',
            position: items.length + 1,
            name: post.city,
            item: `${SITE_ORIGIN}/guides/city/${post.city}`,
        });
    }
    if (post.hashtag) {
        items.push({
            '@type': 'ListItem',
            position: items.length + 1,
            name: humanizeHashtag(post.hashtag),
            item: `${SITE_ORIGIN}/guides/hashtag/${post.hashtag}`,
        });
    }
    items.push({
        '@type': 'ListItem',
        position: items.length + 1,
        name: resolved.title,
        item: `${SITE_ORIGIN}${canonicalPath}`,
    });
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items,
    };
};

const buildItemList = ({ resolved, spaceMeta }: IBuildArgs) => {
    const listSection = resolved.sections.find((s): s is Extract<IPostSection, { type: 'space-list' }> => s.type === 'space-list');
    if (!listSection || !listSection.items?.length) return null;
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: resolved.title,
        numberOfItems: listSection.items.length,
        itemListElement: listSection.items
            .slice()
            .sort((a, b) => (a.rank || 0) - (b.rank || 0))
            .map((item, index) => {
                const meta = spaceMeta?.[item.spaceId];
                const name = meta?.name || item.spaceId;
                const slug = meta?.slug;
                const url = slug
                    ? `${SITE_ORIGIN}/spaces/${item.spaceId}/${slug}`
                    : `${SITE_ORIGIN}/spaces/${item.spaceId}`;
                return {
                    '@type': 'ListItem',
                    position: index + 1,
                    name,
                    url,
                };
            }),
    };
};

const minutesToIso8601 = (minutes: number): string => {
    if (!Number.isFinite(minutes) || minutes <= 0) return 'PT0M';
    const whole = Math.round(minutes);
    const hours = Math.floor(whole / 60);
    const mins = whole % 60;
    if (hours === 0) return `PT${mins}M`;
    if (mins === 0) return `PT${hours}H`;
    return `PT${hours}H${mins}M`;
};

const buildTouristTrip = ({ resolved, spaceMeta }: IBuildArgs) => {
    const routeSection = resolved.sections.find(
        (s): s is Extract<IPostSection, { type: 'walkable-route' }> => s.type === 'walkable-route',
    );
    if (!routeSection || !routeSection.stops?.length) return null;
    const ordered = [...routeSection.stops].sort((a, b) => a.order - b.order);
    return {
        '@context': 'https://schema.org',
        '@type': 'TouristTrip',
        name: resolved.title,
        description: resolved.description,
        touristType: 'Walking tour',
        duration: minutesToIso8601(routeSection.estimatedMinutes),
        itinerary: {
            '@type': 'ItemList',
            numberOfItems: ordered.length,
            itemListElement: ordered.map((stop, index) => {
                const meta = spaceMeta?.[stop.spaceId];
                const name = meta?.name || stop.name || stop.spaceId;
                const slug = meta?.slug;
                const url = slug
                    ? `${SITE_ORIGIN}/spaces/${stop.spaceId}/${slug}`
                    : `${SITE_ORIGIN}/spaces/${stop.spaceId}`;
                return {
                    '@type': 'ListItem',
                    position: index + 1,
                    item: {
                        '@type': 'TouristAttraction',
                        name,
                        url,
                        geo: {
                            '@type': 'GeoCoordinates',
                            latitude: stop.lat,
                            longitude: stop.lng,
                        },
                    },
                };
            }),
        },
    };
};

const buildFaq = ({ resolved }: IBuildArgs) => {
    const faqSection = resolved.sections.find((s): s is Extract<IPostSection, { type: 'faq' }> => s.type === 'faq');
    if (!faqSection || !faqSection.items?.length) return null;
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqSection.items.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
            },
        })),
    };
};

export const buildGuideSchemas = (args: IBuildArgs): IGuideSchemas => {
    const itemList = buildItemList(args);
    const faq = buildFaq(args);
    const touristTrip = buildTouristTrip(args);
    return {
        articleSchema: escapeForJsonLd(buildArticle(args)),
        breadcrumbSchema: escapeForJsonLd(buildBreadcrumb(args)),
        itemListSchema: itemList ? escapeForJsonLd(itemList) : '',
        faqSchema: faq ? escapeForJsonLd(faq) : '',
        touristTripSchema: touristTrip ? escapeForJsonLd(touristTrip) : '',
    };
};
