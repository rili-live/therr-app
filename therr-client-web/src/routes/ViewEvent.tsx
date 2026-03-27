/* eslint-disable max-len, react/jsx-no-target-blank, class-methods-use-this */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { MapActions } from 'therr-react/redux/actions';
import {
    IContentState, IForumsState, IMapState, IUserState,
} from 'therr-react/types';
import { Content } from 'therr-js-utilities/constants';
import { ForumsService } from 'therr-react/services';
import {
    Container, Stack, Group, Title, Text, Badge, Anchor,
    Divider, Image, Skeleton, Breadcrumbs, Paper,
} from '@mantine/core';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';
import getUserContentUri from '../utilities/getUserContentUri';
import ProgressiveImage from '../components/ProgressiveImage';

// Only lazy-load on client (Leaflet requires window/document)
const SpacesMap = typeof window !== 'undefined'
    ? React.lazy(() => import('../components/SpacesMap'))
    : (() => null) as any;

const formatCategoryLabel = (category: string): string => {
    if (!category) return '';
    const label = category.replace('categories.', '').replace('/', ' & ');
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatDateTime = (dateStr: string): string => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

interface IViewEventRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: {
        eventId: string;
    }
}

interface IViewEventDispatchProps {
    getEventDetails: Function;
}

interface IStoreProps extends IViewEventDispatchProps {
    content: IContentState;
    forums: IForumsState;
    map: IMapState;
    user: IUserState;
}

// Regular component props
interface IViewEventProps extends IViewEventRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
}

interface IViewEventState {
    eventId: string;
    groupDetails: any;
    accessRestricted: boolean;
    isGroupPublic: boolean;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    forums: state.forums,
    map: state.map,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getEventDetails: MapActions.getEventDetails,
}, dispatch);

/**
 * ViewEvent
 */
export class ViewEventComponent extends React.Component<IViewEventProps, IViewEventState> {
    static getDerivedStateFromProps(nextProps: IViewEventProps) {
        if (!nextProps.routeParams.eventId) {
            setTimeout(() => nextProps.navigation.navigate('/'));
            return null;
        }
        return {};
    }

    constructor(props: IViewEventProps) {
        super(props);

        this.state = {
            eventId: props.routeParams.eventId,
            groupDetails: null,
            accessRestricted: false,
            isGroupPublic: true,
        };
    }

    componentDidMount() {
        const { getEventDetails, forums, map } = this.props;
        const { eventId } = this.state;
        const event = map?.events[eventId];

        if (!event) {
            getEventDetails(this.state.eventId, {
                withMedia: true,
                withUser: true,
                withRatings: true,
            }).then((response) => {
                const fetchedEvent = response?.event;
                if (response?.accessRestricted) {
                    this.setState({
                        accessRestricted: true,
                        isGroupPublic: !!response.isGroupPublic,
                    });
                }
                if (fetchedEvent?.notificationMsg) {
                    document.title = `${fetchedEvent.notificationMsg} | Therr App`;
                }
                this.fetchGroupDetails(fetchedEvent?.groupId, forums);
            }).catch(() => {
                this.props.navigation.navigate('/');
            });
        } else {
            document.title = `${event.notificationMsg} | Therr App`;
            this.fetchGroupDetails(event.groupId, forums);
        }
    }

    fetchGroupDetails(groupId: string, forums: IForumsState) {
        if (!groupId) return;

        // Use cached data from Redux if available
        const cached = forums?.forumDetails?.[groupId];
        if (cached) {
            this.setState({ groupDetails: cached });
            return;
        }

        ForumsService.getForum(groupId).then((response: any) => {
            this.setState({ groupDetails: response?.data });
        }).catch(() => {
            // Group may not exist or be inaccessible - silently ignore
        });
    }

    renderSkeleton(): JSX.Element {
        return (
            <Container id="page_view_event" size="lg" py="xl">
                <Stack gap="md">
                    <Skeleton height={16} width="40%" />
                    <Skeleton height={300} radius="md" />
                    <Skeleton height={32} width="60%" />
                    <Skeleton height={20} width="30%" />
                    <Skeleton height={1} />
                    <Skeleton height={80} />
                </Stack>
            </Container>
        );
    }

    renderBreadcrumbs(event: any): JSX.Element {
        const items = [
            <Anchor href="/" key="home">{this.props.translate('pages.navigation.home')}</Anchor>,
            <Text key="events" component="span">{this.props.translate('pages.navigation.events')}</Text>,
            <Text key="title" component="span">{event.notificationMsg}</Text>,
        ];

        return <Breadcrumbs className="event-breadcrumbs">{items}</Breadcrumbs>;
    }

    renderDateRange(event: any): JSX.Element | null {
        if (!event.scheduleStartAt && !event.scheduleStopAt) return null;

        return (
            <Paper withBorder p="md" radius="md">
                <Title order={3} size="h4" mb="xs">{this.props.translate('pages.viewEvent.headings.when')}</Title>
                {event.scheduleStartAt && (
                    <Group gap="xs">
                        <Text fw={600}>{this.props.translate('pages.viewEvent.labels.startDate')}:</Text>
                        <Text>{formatDateTime(event.scheduleStartAt)}</Text>
                    </Group>
                )}
                {event.scheduleStopAt && (
                    <Group gap="xs">
                        <Text fw={600}>{this.props.translate('pages.viewEvent.labels.endDate')}:</Text>
                        <Text>{formatDateTime(event.scheduleStopAt)}</Text>
                    </Group>
                )}
            </Paper>
        );
    }

    renderHashTags(event: any): JSX.Element | null {
        if (!event.hashTags) return null;
        const tags = event.hashTags.split(',').map((t: string) => t.trim()).filter(Boolean);
        if (tags.length === 0) return null;

        return (
            <Group gap="xs" mt="sm" wrap="wrap">
                {tags.map((tag: string) => (
                    <Badge key={tag} variant="light" size="sm">#{tag}</Badge>
                ))}
            </Group>
        );
    }

    renderSpaceCard(event: any): JSX.Element | null {
        if (!event.spaceId) return null;

        const space = event.space;
        const spaceName = space?.notificationMsg || event.areaTitle || this.props.translate('pages.viewEvent.labels.viewSpace');
        const spaceAddress = space?.addressReadable || '';

        // Get space media if available
        const { content } = this.props;
        let spaceMediaUri;
        if (space?.medias?.[0]) {
            const mediaPath = space.medias[0].path;
            const mediaType = space.medias[0].type;
            spaceMediaUri = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
                ? getUserContentUri(space.medias[0], 120, 120, true)
                : content?.media?.[mediaPath];
        }

        return (
            <div>
                <Title order={3} size="h4" mb="xs">{this.props.translate('pages.viewEvent.headings.where')}</Title>
                <Anchor href={`/spaces/${event.spaceId}`} underline="never" className="event-space-link">
                    <Paper withBorder p="md" radius="md" className="event-space-card">
                        <Group gap="md" wrap="nowrap">
                            {spaceMediaUri && (
                                <Image
                                    src={spaceMediaUri}
                                    alt={spaceName}
                                    w={80}
                                    h={80}
                                    radius="sm"
                                    fit="cover"
                                    loading="lazy"
                                />
                            )}
                            <Stack gap={4}>
                                <Text fw={600}>{spaceName}</Text>
                                {spaceAddress && <Text size="sm" c="dimmed">{spaceAddress}</Text>}
                                {space?.category && (
                                    <Badge variant="light" size="xs">{formatCategoryLabel(space.category)}</Badge>
                                )}
                            </Stack>
                        </Group>
                    </Paper>
                </Anchor>
                {this.renderLocationMap(event, space)}
            </div>
        );
    }

    renderLocationMap(event: any, space: any): JSX.Element | null {
        const lat = space?.latitude || event.latitude;
        const lng = space?.longitude || event.longitude;

        if (!lat || !lng) {
            // Fall back to address-only Google Maps link
            const spaceAddress = space?.addressReadable || '';
            if (!spaceAddress) return null;
            return (
                <Anchor
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spaceAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    mt="xs"
                >
                    {this.props.translate('pages.viewEvent.labels.viewOnGoogleMaps')}
                </Anchor>
            );
        }

        const mapLabel = space?.notificationMsg || event.notificationMsg || '';
        const mapAddress = space?.addressReadable || '';

        return (
            <>
                <React.Suspense fallback={<Skeleton height={200} radius="md" mt="sm" />}>
                    <SpacesMap
                        spaces={[{
                            id: event.spaceId || event.id,
                            notificationMsg: mapLabel,
                            addressReadable: mapAddress,
                            latitude: lat,
                            longitude: lng,
                        }]}
                        centerLat={lat}
                        centerLng={lng}
                        localePrefix=""
                        zoom={15}
                        height={200}
                        interactive={false}
                    />
                </React.Suspense>
                <Anchor
                    href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    mt="xs"
                >
                    {this.props.translate('pages.viewEvent.labels.viewOnGoogleMaps')}
                </Anchor>
            </>
        );
    }

    renderGroupCard(event: any): JSX.Element | null {
        if (!event.groupId) return null;

        const { groupDetails } = this.state;
        const groupName = groupDetails?.title || this.props.translate('pages.viewEvent.labels.viewGroup');
        const organizerName = event.fromUserFirstName && event.fromUserLastName
            ? `${event.fromUserFirstName} ${event.fromUserLastName}`
            : '';

        return (
            <div>
                <Title order={3} size="h4" mb="xs">{this.props.translate('pages.viewEvent.headings.group')}</Title>
                <Anchor href={`/groups/${event.groupId}`} underline="never" className="event-space-link">
                    <Paper withBorder p="md" radius="md" className="event-space-card">
                        <Group gap="md" wrap="nowrap">
                            <Stack gap={4}>
                                <Text fw={600}>{groupName}</Text>
                                {groupDetails?.subtitle && <Text size="sm" c="dimmed">{groupDetails.subtitle}</Text>}
                            </Stack>
                        </Group>
                    </Paper>
                </Anchor>
                {organizerName && (
                    <Group gap="xs" mt="xs">
                        <Text size="sm" fw={600}>{this.props.translate('pages.viewEvent.headings.organizer')}:</Text>
                        {event.fromUserId ? (
                            <Anchor href={`/users/${event.fromUserId}`} size="sm">{organizerName}</Anchor>
                        ) : (
                            <Text size="sm">{organizerName}</Text>
                        )}
                    </Group>
                )}
            </div>
        );
    }

    renderLoginLinks(): JSX.Element {
        return (
            <Group gap="sm" justify="center">
                <Anchor href="/login">{this.props.translate('components.header.buttons.login')}</Anchor>
                <Anchor href="/register">{this.props.translate('pages.login.buttons.signUp')}</Anchor>
            </Group>
        );
    }

    renderPrivateEventMessage(): JSX.Element {
        return (
            <Container id="page_view_event" size="md" py="xl">
                <Stack gap="md" align="center">
                    <Title order={2}>{this.props.translate('pages.viewEvent.labels.privateEventMessage')}</Title>
                    <Text c="dimmed" ta="center">{this.props.translate('pages.viewEvent.labels.privateEventCta')}</Text>
                    {this.renderLoginLinks()}
                </Stack>
            </Container>
        );
    }

    renderSignUpCta(): JSX.Element {
        return (
            <Paper withBorder p="lg" radius="md" className="event-cta-card">
                <Text fw={600} ta="center">{this.props.translate('pages.viewEvent.labels.signUpPrompt')}</Text>
                {this.renderLoginLinks()}
            </Paper>
        );
    }

    public render(): JSX.Element {
        const { content, map, user } = this.props;
        const { eventId, accessRestricted, isGroupPublic } = this.state;
        const event = map?.events[eventId];
        const isAuthenticated = !!user?.details?.id;

        if (!event) {
            return this.renderSkeleton();
        }

        // Private group event check for unauthenticated users
        if (accessRestricted && !isGroupPublic && !isAuthenticated) {
            return this.renderPrivateEventMessage();
        }

        // Use the cacheable api-gateway media endpoint when image is public otherwise fallback to signed url
        const mediaPath = (event.medias?.[0]?.path);
        const mediaType = (event.medias?.[0]?.type);
        const eventMedia = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
            ? getUserContentUri(event.medias?.[0], 480, 480, true)
            : content?.media?.[mediaPath];

        const categoryLabel = formatCategoryLabel(event.category);

        return (
            <Container id="page_view_event" size="lg" py="xl">
                <Stack gap="md">
                    {/* Breadcrumbs */}
                    {this.renderBreadcrumbs(event)}

                    {/* Hero Image */}
                    {eventMedia && (
                        <div className="event-hero-image-wrapper">
                            <ProgressiveImage
                                src={eventMedia}
                                alt={event.notificationMsg}
                                className="event-hero-image"
                                fallbackSrc="/assets/images/meta-image-logo.png"
                                radius="md"
                                fetchPriority="high"
                            />
                        </div>
                    )}

                    {/* Title & Meta */}
                    <div className="event-title-section">
                        <Title order={1}>{event.notificationMsg}</Title>

                        <Group gap="sm" mt="xs" wrap="wrap">
                            {categoryLabel && (
                                <Badge variant="light" size="lg">{categoryLabel}</Badge>
                            )}
                        </Group>
                    </div>

                    {/* Date / Time Range */}
                    {this.renderDateRange(event)}

                    {/* Venue / Space Card */}
                    {this.renderSpaceCard(event)}

                    {/* Standalone map when event has coordinates but no linked space */}
                    {!event.spaceId && this.renderLocationMap(event, null)}

                    {/* Group & Organizer */}
                    {this.renderGroupCard(event)}

                    <Divider />

                    {/* Content / Description */}
                    {event.message && (
                        <div className="event-description">
                            <Title order={3} size="h4" mb="xs">{this.props.translate('pages.viewEvent.headings.about')}</Title>
                            <Text style={{ whiteSpace: 'pre-wrap' }}>{event.message}</Text>
                            {this.renderHashTags(event)}
                        </div>
                    )}

                    {/* Login/Signup CTA for unauthenticated users */}
                    {accessRestricted && !isAuthenticated && this.renderSignUpCta()}

                    {/* App Download CTA */}
                    <Paper withBorder p="lg" radius="md" mt="md" className="event-cta-card">
                        <Text fw={600} ta="center">{this.props.translate('pages.viewSpace.labels.getFullExperience')}</Text>
                        <Group justify="center" mt="sm" gap="md">
                            <Anchor href="https://apps.apple.com/us/app/therr/id1569988763?platform=iphone" target="_blank" rel="noreferrer">
                                <Image aria-label="apple store link" maw={120} src="/assets/images/apple-store-download-button.svg" alt="Download Therr on the App Store" loading="lazy" />
                            </Anchor>
                            <Anchor href="https://play.google.com/store/apps/details?id=app.therrmobile" target="_blank" rel="noreferrer">
                                <Image aria-label="play store link" maw={120} src="/assets/images/play-store-download-button.svg" alt="Download Therr on Google Play" loading="lazy" />
                            </Anchor>
                        </Group>
                    </Paper>
                </Stack>
            </Container>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(ViewEventComponent)));
