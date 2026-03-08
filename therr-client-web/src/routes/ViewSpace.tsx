/* eslint-disable max-len, react/jsx-no-target-blank, class-methods-use-this */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { MapActions } from 'therr-react/redux/actions';
import { IContentState, IMapState, IUserState } from 'therr-react/types';
import { Content } from 'therr-js-utilities/constants';
import {
    Container, Stack, Group, Title, Text, Badge, Anchor,
    Divider, Image, Skeleton, Breadcrumbs,
    SimpleGrid, Rating as MantineRating,
} from '@mantine/core';
import translator from '../services/translator';
import withNavigation from '../wrappers/withNavigation';
import getUserContentUri from '../utilities/getUserContentUri';

const formatCategoryLabel = (category: string): string => {
    if (!category) return '';
    const label = category.replace('categories.', '').replace('/', ' & ');
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatPriceRange = (priceRange: number): string => '$'.repeat(priceRange);

const parseOpeningHours = (schema: string[]): { days: string; hours: string }[] => schema.map((entry) => {
    const parts = entry.split(' ');
    return {
        days: parts[0] || '',
        hours: parts.slice(1).join(' ') || '',
    };
});

interface IViewSpaceRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: {
        spaceId: string;
    }
}

interface IViewSpaceDispatchProps {
    login: Function;
    getSpaceDetails: Function;
}

interface IStoreProps extends IViewSpaceDispatchProps {
    content: IContentState;
    map: IMapState;
    user: IUserState;
}

// Regular component props
interface IViewSpaceProps extends IViewSpaceRouterProps, IStoreProps {
}

interface IViewSpaceState {
    spaceId: string;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    map: state.map,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getSpaceDetails: MapActions.getSpaceDetails,
}, dispatch);

/**
 * ViewSpace
 */
export class ViewSpaceComponent extends React.Component<IViewSpaceProps, IViewSpaceState> {
    private translate: Function;

    static getDerivedStateFromProps(nextProps: IViewSpaceProps) {
        if (!nextProps.routeParams.spaceId) {
            setTimeout(() => nextProps.navigation.navigate('/'));
            return null;
        }
        return {};
    }

    constructor(props: IViewSpaceProps) {
        super(props);

        this.state = {
            spaceId: props.routeParams.spaceId,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        const { getSpaceDetails, map } = this.props;
        const { spaceId } = this.state;
        const space = map?.spaces[spaceId];

        if (!space || !space?.message) {
            getSpaceDetails(this.state.spaceId, {
                withMedia: true,
                withUser: true,
                withRatings: true,
            }).then(({ space: fetchedSpace }) => {
                document.title = `${fetchedSpace?.notificationMsg} | Therr App`;
            }).catch(() => {
                this.props.navigation.navigate('/');
            });
        } else {
            document.title = `${space.notificationMsg} | Therr App`;
        }
    }

    login = (credentials: any) => this.props.login(credentials);

    renderSkeleton(): JSX.Element {
        return (
            <Container id="page_view_space" size="lg" py="xl">
                <Stack gap="md">
                    <Skeleton height={16} width="40%" />
                    <Skeleton height={300} radius="md" />
                    <Skeleton height={32} width="60%" />
                    <Skeleton height={20} width="40%" />
                    <Group gap="sm">
                        <Skeleton height={30} width={80} radius="xl" />
                        <Skeleton height={30} width={80} radius="xl" />
                    </Group>
                    <Skeleton height={1} />
                    <Skeleton height={100} />
                </Stack>
            </Container>
        );
    }

    renderBreadcrumbs(space: any): JSX.Element {
        const locality = space.addressLocality || space.addressRegion || '';
        const items = [
            <Anchor href="/" key="home">Home</Anchor>,
            <Anchor href="/locations" key="locations">Locations</Anchor>,
        ];
        if (locality) {
            items.push(<Text key="locality" component="span">{locality}</Text>);
        }
        items.push(<Text key="title" component="span">{space.notificationMsg}</Text>);

        return <Breadcrumbs className="space-breadcrumbs">{items}</Breadcrumbs>;
    }

    renderActionLinks(space: any): JSX.Element | null {
        const links = [
            { url: space.websiteUrl, label: 'Website' },
            { url: space.menuUrl, label: 'Menu' },
            { url: space.phoneNumber, label: 'Phone', href: `tel:${space.phoneNumber}` },
            { url: space.orderUrl, label: 'Order Delivery' },
            { url: space.reservationUrl, label: 'Reservations' },
        ].filter((link) => !!link.url);

        if (links.length === 0) return null;

        return (
            <Group gap="sm" className="space-action-links" wrap="wrap">
                {links.map((link) => (
                    <Anchor
                        key={link.label}
                        href={link.href || link.url}
                        target="_blank"
                        className="space-action-link"
                    >
                        {link.label}
                    </Anchor>
                ))}
            </Group>
        );
    }

    renderOpeningHours(space: any): JSX.Element | null {
        if (!space.openingHours?.schema?.length) return null;

        const hours = parseOpeningHours(space.openingHours.schema);

        return (
            <>
                <Title order={3} size="h4" mt="lg">Hours</Title>
                <div className="space-hours-grid">
                    {hours.map((entry) => (
                        <div key={entry.days} className="space-hours-row">
                            <Text fw={600} component="span">{entry.days}</Text>
                            <Text component="span">{entry.hours}</Text>
                        </div>
                    ))}
                </div>
            </>
        );
    }

    renderAddress(space: any): JSX.Element | null {
        const hasAddress = space.addressStreetAddress || space.addressLocality || space.addressRegion;
        if (!hasAddress && !space.phoneNumber) return null;

        const lat = space.latitude;
        const lng = space.longitude;

        return (
            <>
                <Title order={3} size="h4" mt="lg">Contact &amp; Location</Title>
                <address className="space-address">
                    {space.addressStreetAddress && <Text>{space.addressStreetAddress}</Text>}
                    {(space.addressLocality || space.addressRegion) && (
                        <Text>
                            {[space.addressLocality, space.addressRegion].filter(Boolean).join(', ')}
                            {space.postalCode ? ` ${space.postalCode}` : ''}
                        </Text>
                    )}
                    {space.region && <Text>{space.region}</Text>}
                    {space.phoneNumber && (
                        <Text mt="xs">
                            <Anchor href={`tel:${space.phoneNumber}`}>{space.phoneNumber}</Anchor>
                        </Text>
                    )}
                </address>
                {lat && lng && (
                    <Anchor
                        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                        target="_blank"
                        mt="xs"
                        display="inline-block"
                    >
                        View on Google Maps
                    </Anchor>
                )}
            </>
        );
    }

    renderHashTags(space: any): JSX.Element | null {
        if (!space.hashTags) return null;
        const tags = space.hashTags.split(',').map((t: string) => t.trim()).filter(Boolean);
        if (tags.length === 0) return null;

        return (
            <Group gap="xs" mt="sm" wrap="wrap">
                {tags.map((tag: string) => (
                    <Badge key={tag} variant="light" size="sm">{tag}</Badge>
                ))}
            </Group>
        );
    }

    renderEvents(space: any): JSX.Element | null {
        if (!space.events?.length) return null;

        return (
            <>
                <Title order={2} size="h3" mt="xl">Events</Title>
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md" mt="sm">
                    {space.events.map((event: any) => (
                        <Anchor key={event.id} href={`/events/${event.id}`} underline="never" className="space-event-card">
                            <Text fw={600}>{event.title || event.notificationMsg}</Text>
                        </Anchor>
                    ))}
                </SimpleGrid>
            </>
        );
    }

    public render(): JSX.Element {
        const { content, map } = this.props;
        const { spaceId } = this.state;
        const space = map?.spaces[spaceId];

        if (!space) {
            return this.renderSkeleton();
        }

        // Use the cacheable api-gateway media endpoint when image is public otherwise fallback to signed url
        const mediaPath = (space.medias?.[0]?.path);
        const mediaType = (space.medias?.[0]?.type);
        const spaceMedia = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
            ? getUserContentUri(space.medias?.[0], 480, 480, true)
            : content?.media?.[mediaPath];

        const categoryLabel = formatCategoryLabel(space.category);
        const hasRating = space.rating?.avgRating != null && space.rating.avgRating > 0;

        return (
            <Container id="page_view_space" size="lg" py="xl">
                <Stack gap="md">
                    {/* Breadcrumbs */}
                    {this.renderBreadcrumbs(space)}

                    {/* Hero Image */}
                    {spaceMedia && (
                        <div className="space-hero-image-wrapper">
                            <Image
                                src={spaceMedia}
                                alt={space.notificationMsg}
                                className="space-hero-image"
                                fallbackSrc="/assets/images/meta-image-logo.png"
                                radius="md"
                            />
                        </div>
                    )}

                    {/* Title & Meta */}
                    <div className="space-title-section">
                        <Title order={1}>{space.notificationMsg}</Title>
                        {space.addressReadable && (
                            <Title order={2} size="h4" c="dimmed" fw={400}>{space.addressReadable}</Title>
                        )}

                        <Group gap="sm" mt="xs" wrap="wrap">
                            {categoryLabel && (
                                <Badge variant="light" size="lg">{categoryLabel}</Badge>
                            )}
                            {space.priceRange > 0 && (
                                <Text fw={600} c="dimmed">{formatPriceRange(space.priceRange)}</Text>
                            )}
                        </Group>

                        {hasRating && (
                            <Group gap="xs" mt="xs">
                                <MantineRating value={space.rating.avgRating} fractions={2} readOnly />
                                <Text size="sm" c="dimmed">
                                    {space.rating.avgRating.toFixed(1)} ({space.rating.totalRatings} {space.rating.totalRatings === 1 ? 'review' : 'reviews'})
                                </Text>
                            </Group>
                        )}
                    </div>

                    {/* Action Links */}
                    {this.renderActionLinks(space)}

                    <Divider />

                    {/* Description */}
                    {space.message && (
                        <div className="space-description">
                            <Text>{space.message}</Text>
                            {this.renderHashTags(space)}
                        </div>
                    )}

                    {/* Opening Hours */}
                    {this.renderOpeningHours(space)}

                    {/* Contact & Address */}
                    {this.renderAddress(space)}

                    {/* Events */}
                    {this.renderEvents(space)}
                </Stack>
            </Container>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(ViewSpaceComponent));
