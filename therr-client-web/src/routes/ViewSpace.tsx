/* eslint-disable max-len, react/jsx-no-target-blank, class-methods-use-this */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { MapActions } from 'therr-react/redux/actions';
import { MapsService } from 'therr-react/services';
import { IContentState, IMapState, IUserState } from 'therr-react/types';
import { Content } from 'therr-js-utilities/constants';
import {
    Container, Stack, Group, Title, Text, Badge, Anchor,
    Divider, Image, Skeleton, Breadcrumbs,
    SimpleGrid, Rating as MantineRating, Paper, Avatar,
} from '@mantine/core';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';
import getUserContentUri from '../utilities/getUserContentUri';
import ProgressiveImage from '../components/ProgressiveImage';

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
    translate: (key: string, params?: any) => string;
}

interface IViewSpaceState {
    spaceId: string;
    spaceMoments: any[];
    isMomentsLoading: boolean;
    spacePairings: any[];
    isPairingsLoading: boolean;
    pairingFeedback: { [id: string]: boolean };
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
            spaceMoments: [],
            isMomentsLoading: false,
            spacePairings: [],
            isPairingsLoading: false,
            pairingFeedback: {},
        };
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
                this.fetchSpaceMoments(spaceId);
                this.fetchSpacePairings(spaceId);
            }).catch(() => {
                this.props.navigation.navigate('/');
            });
        } else {
            document.title = `${space.notificationMsg} | Therr App`;
            this.fetchSpaceMoments(spaceId);
            this.fetchSpacePairings(spaceId);
        }
    }

    fetchSpaceMoments = (spaceId: string) => {
        this.setState({ isMomentsLoading: true });
        MapsService.getSpaceMoments(
            { itemsPerPage: 20, pageNumber: 1 },
            [spaceId],
            true,
        ).then((response: any) => {
            this.setState({
                spaceMoments: response?.data?.results || [],
                isMomentsLoading: false,
            });
        }).catch(() => {
            this.setState({ isMomentsLoading: false });
        });
    };

    fetchSpacePairings = (spaceId: string) => {
        this.setState({ isPairingsLoading: true });
        MapsService.getSpacePairings(spaceId)
            .then((response: any) => {
                this.setState({
                    spacePairings: response?.data?.pairings || [],
                    isPairingsLoading: false,
                });
            })
            .catch(() => {
                this.setState({ isPairingsLoading: false });
            });
    };

    handlePairingFeedback = (pairedSpaceId: string, isHelpful: boolean) => {
        const { spaceId } = this.state;
        this.setState((prevState) => ({
            pairingFeedback: { ...prevState.pairingFeedback, [pairedSpaceId]: isHelpful },
        }));
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        MapsService.submitPairingFeedback(spaceId, pairedSpaceId, isHelpful).catch(() => {});
    };

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
            <Anchor href="/" key="home">{this.props.translate('pages.navigation.home')}</Anchor>,
            <Anchor href="/locations" key="locations">{this.props.translate('pages.navigation.locations')}</Anchor>,
        ];
        if (locality) {
            items.push(<Text key="locality" component="span">{locality}</Text>);
        }
        items.push(<Text key="title" component="span">{space.notificationMsg}</Text>);

        return <Breadcrumbs className="space-breadcrumbs">{items}</Breadcrumbs>;
    }

    renderActionLinks(space: any): JSX.Element | null {
        const { translate } = this.props;
        const links = [
            { url: space.websiteUrl, label: translate('pages.viewSpace.labels.website') },
            { url: space.menuUrl, label: translate('pages.viewSpace.labels.menu') },
            { url: space.phoneNumber, label: translate('pages.viewSpace.labels.phone'), href: `tel:${space.phoneNumber}` },
            { url: space.orderUrl, label: translate('pages.viewSpace.labels.orderDelivery') },
            { url: space.reservationUrl, label: translate('pages.viewSpace.labels.reservations') },
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
                <Title order={3} size="h4" mt="lg">{this.props.translate('pages.viewSpace.headings.hours')}</Title>
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
                <Title order={3} size="h4" mt="lg">{this.props.translate('pages.viewSpace.headings.contactAndLocation')}</Title>
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
                        {this.props.translate('pages.viewSpace.labels.viewOnGoogleMaps')}
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
                <Title order={2} size="h3" mt="xl">{this.props.translate('pages.viewSpace.headings.events')}</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="sm">
                    {space.events.map((event: any) => {
                        const startDate = event.scheduleStartAt
                            ? new Date(event.scheduleStartAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : '';
                        const description = event.message
                            ? event.message.replace(/\\n/g, ' ').replace(/\\r/g, ' ').substring(0, 120)
                            : '';
                        const categoryLabel = formatCategoryLabel(event.category);

                        return (
                            <Anchor key={event.id} href={`/events/${event.id}`} underline="never">
                                <Paper withBorder p="md" radius="md" className="space-event-card">
                                    <Stack gap="xs">
                                        <Text fw={600} lineClamp={1}>{event.title || event.notificationMsg}</Text>
                                        {startDate && <Text size="sm" c="dimmed">{startDate}</Text>}
                                        {categoryLabel && <Badge variant="light" size="xs">{categoryLabel}</Badge>}
                                        {description && <Text size="sm" c="dimmed" lineClamp={3}>{description}</Text>}
                                    </Stack>
                                </Paper>
                            </Anchor>
                        );
                    })}
                </SimpleGrid>
            </>
        );
    }

    renderMomentCard(moment: any): JSX.Element {
        const authorName = moment.fromUserFirstName && moment.fromUserLastName
            ? `${moment.fromUserFirstName} ${moment.fromUserLastName}`
            : moment.fromUserName || this.props.translate('pages.viewSpace.labels.anonymous');

        const dateStr = moment.createdAt
            ? new Date(moment.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            : '';

        // Get moment media
        const { content } = this.props;
        const mediaPath = moment.medias?.[0]?.path;
        const mediaType = moment.medias?.[0]?.type;
        let momentMedia;
        if (mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC) {
            momentMedia = getUserContentUri(moment.medias[0], 200, 200, true);
        } else if (mediaPath) {
            momentMedia = content?.media?.[mediaPath];
        }

        return (
            <Paper key={moment.id} withBorder p="md" radius="md" className="space-review-card">
                <Group gap="sm" mb="xs" wrap="nowrap">
                    <Avatar size={36} radius="xl" color="teal">
                        {authorName.charAt(0).toUpperCase()}
                    </Avatar>
                    <Stack gap={0} style={{ flex: 1 }}>
                        <Group gap="xs">
                            {moment.fromUserId ? (
                                <Anchor href={`/users/${moment.fromUserId}`} size="sm" fw={600}>{authorName}</Anchor>
                            ) : (
                                <Text size="sm" fw={600}>{authorName}</Text>
                            )}
                        </Group>
                        {dateStr && <Text size="xs" c="dimmed">{dateStr}</Text>}
                    </Stack>
                </Group>
                {moment.notificationMsg && (
                    <Text fw={500} mb={4}>{moment.notificationMsg}</Text>
                )}
                {moment.message && (
                    <Text size="sm" lineClamp={4} style={{ whiteSpace: 'pre-wrap' }}>{moment.message}</Text>
                )}
                {momentMedia && (
                    <Image
                        src={momentMedia}
                        alt={moment.notificationMsg || 'Review image'}
                        mt="sm"
                        radius="sm"
                        mah={200}
                        fit="cover"
                        loading="lazy"
                    />
                )}
                {moment.hashTags && (
                    <Group gap="xs" mt="xs" wrap="wrap">
                        {moment.hashTags.split(',').map((t: string) => t.trim()).filter(Boolean).map((tag: string) => (
                            <Badge key={tag} variant="light" size="xs">#{tag}</Badge>
                        ))}
                    </Group>
                )}
                <Anchor href={`/moments/${moment.id}`} size="xs" mt="xs" display="inline-block">
                    {this.props.translate('pages.viewSpace.labels.readMore')}
                </Anchor>
            </Paper>
        );
    }

    renderPairings(): JSX.Element | null {
        const { map, translate } = this.props;
        const {
            spaceId, spacePairings, isPairingsLoading, pairingFeedback,
        } = this.state;
        const space = map?.spaces[spaceId];
        const spaceName = space?.notificationMsg || '';

        if (isPairingsLoading) {
            return (
                <section>
                    <Title order={2} size="h3" mt="xl">{translate('pages.viewSpace.headings.youMightAlsoLike')}</Title>
                    <Text size="sm" c="dimmed" mt={4}>{translate('pages.viewSpace.headings.pairingsDescription', { spaceName })}</Text>
                    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md" mt="sm">
                        <Skeleton height={160} radius="md" />
                        <Skeleton height={160} radius="md" />
                        <Skeleton height={160} radius="md" />
                    </SimpleGrid>
                </section>
            );
        }

        if (!spacePairings.length) return null;

        return (
            <section>
                <Title order={2} size="h3" mt="xl">{translate('pages.viewSpace.headings.youMightAlsoLike')}</Title>
                <Text size="sm" c="dimmed" mt={4}>{translate('pages.viewSpace.headings.pairingsDescription', { spaceName })}</Text>
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md" mt="sm">
                    {spacePairings.map((pairing: any) => {
                        const mediaPath = pairing.medias?.[0]?.path;
                        const mediaType = pairing.medias?.[0]?.type;
                        const pairingMedia = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
                            ? getUserContentUri(pairing.medias[0], 200, 200, true)
                            : undefined;
                        const catLabel = formatCategoryLabel(pairing.category);
                        const hasFeedback = pairingFeedback[pairing.id] !== undefined;

                        return (
                            <Paper key={pairing.id} withBorder p="md" radius="md">
                                {pairingMedia && (
                                    <Image
                                        src={pairingMedia}
                                        alt={pairing.notificationMsg || 'Space image'}
                                        height={120}
                                        fit="cover"
                                        radius="sm"
                                        mb="sm"
                                        loading="lazy"
                                    />
                                )}
                                <Anchor href={`/spaces/${pairing.id}`} fw={600} size="sm">
                                    {pairing.notificationMsg}
                                </Anchor>
                                {catLabel && <Badge variant="light" size="xs" mt={4}>{catLabel}</Badge>}
                                {pairing.addressReadable && (
                                    <Text size="xs" c="dimmed" mt={4}>{pairing.addressReadable}</Text>
                                )}
                                <Group gap="xs" mt="xs">
                                    {hasFeedback ? (
                                        <Text size="xs" c="dimmed">
                                            {pairingFeedback[pairing.id]
                                                ? translate('pages.viewSpace.labels.helpful')
                                                : translate('pages.viewSpace.labels.notHelpful')}
                                        </Text>
                                    ) : (
                                        <>
                                            <Anchor
                                                size="xs"
                                                component="button"
                                                type="button"
                                                onClick={() => this.handlePairingFeedback(pairing.id, true)}
                                            >
                                                {translate('pages.viewSpace.labels.helpful')}
                                            </Anchor>
                                            <Text size="xs" c="dimmed">|</Text>
                                            <Anchor
                                                size="xs"
                                                component="button"
                                                type="button"
                                                onClick={() => this.handlePairingFeedback(pairing.id, false)}
                                            >
                                                {translate('pages.viewSpace.labels.notHelpful')}
                                            </Anchor>
                                        </>
                                    )}
                                </Group>
                            </Paper>
                        );
                    })}
                </SimpleGrid>
            </section>
        );
    }

    renderCommunityPosts(): JSX.Element | null {
        const { spaceMoments, isMomentsLoading } = this.state;

        if (isMomentsLoading) {
            return (
                <>
                    <Title order={2} size="h3" mt="xl">{this.props.translate('pages.viewSpace.headings.whatPeopleAreSaying')}</Title>
                    <Stack gap="md" mt="sm">
                        <Skeleton height={120} radius="md" />
                        <Skeleton height={120} radius="md" />
                    </Stack>
                </>
            );
        }

        if (!spaceMoments.length) return null;

        return (
            <>
                <Title order={2} size="h3" mt="xl">{this.props.translate('pages.viewSpace.headings.whatPeopleAreSaying')} ({spaceMoments.length})</Title>
                <Stack gap="md" mt="sm">
                    {spaceMoments.map((moment: any) => this.renderMomentCard(moment))}
                </Stack>
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
                            <ProgressiveImage
                                src={spaceMedia}
                                alt={space.notificationMsg}
                                className="space-hero-image"
                                fallbackSrc="/assets/images/meta-image-logo.png"
                                radius="md"
                                fetchPriority="high"
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
                                    {space.rating.avgRating.toFixed(1)} ({space.rating.totalRatings} {space.rating.totalRatings === 1 ? this.props.translate('pages.viewSpace.labels.review') : this.props.translate('pages.viewSpace.labels.reviews')})
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

                    {/* Community Posts (Moments) */}
                    {this.renderCommunityPosts()}

                    {/* Local (Pairings) */}
                    {this.renderPairings()}

                    {/* App Download CTA */}
                    <Paper withBorder p="sm" radius="md" mt="md">
                        <Group justify="center" gap="md" wrap="wrap">
                            <Text size="sm" c="dimmed">{this.props.translate('pages.viewSpace.labels.getFullExperience')}</Text>
                            <Group gap="xs" className="store-image-links">
                                <Anchor href="https://apps.apple.com/us/app/therr/id1569988763?platform=iphone" target="_blank" rel="noreferrer">
                                    <Image
                                        aria-label="apple store link"
                                        maw={120}
                                        src="/assets/images/apple-store-download-button.svg"
                                        alt="Download Therr on the App Store"
                                        loading="lazy"
                                    />
                                </Anchor>
                                <Anchor href="https://play.google.com/store/apps/details?id=app.therrmobile" target="_blank" rel="noreferrer">
                                    <Image
                                        aria-label="play store link"
                                        maw={120}
                                        src="/assets/images/play-store-download-button.svg"
                                        alt="Download Therr on Google Play"
                                        loading="lazy"
                                    />
                                </Anchor>
                            </Group>
                        </Group>
                    </Paper>
                </Stack>
            </Container>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(ViewSpaceComponent)));
