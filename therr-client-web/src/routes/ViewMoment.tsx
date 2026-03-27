/* eslint-disable max-len, react/jsx-no-target-blank, class-methods-use-this */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { MapActions } from 'therr-react/redux/actions';
import { IContentState, IMapState, IUserState } from 'therr-react/types';
import { Content } from 'therr-js-utilities/constants';
import {
    ActionIcon, Container, Stack, Group, Title, Text, Badge, Anchor,
    Divider, Image, Skeleton, Breadcrumbs, Paper, Tooltip,
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

interface IViewMomentRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: {
        momentId: string;
    }
}

interface IViewMomentDispatchProps {
    login: Function;
    getMomentDetails: Function;
}

interface IStoreProps extends IViewMomentDispatchProps {
    content: IContentState;
    map: IMapState;
    user: IUserState;
}

// Regular component props
interface IViewMomentProps extends IViewMomentRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
}

interface IViewMomentState {
    momentId: string;
    isLinkCopied: boolean;
    isMapVisible: boolean;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    map: state.map,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getMomentDetails: MapActions.getMomentDetails,
}, dispatch);

/**
 * ViewMoment
 */
export class ViewMomentComponent extends React.Component<IViewMomentProps, IViewMomentState> {
    static getDerivedStateFromProps(nextProps: IViewMomentProps) {
        if (!nextProps.routeParams.momentId) {
            setTimeout(() => nextProps.navigation.navigate('/'));
            return null;
        }
        return {};
    }

    constructor(props: IViewMomentProps) {
        super(props);

        this.state = {
            momentId: props.routeParams.momentId,
            isLinkCopied: false,
            isMapVisible: false,
        };
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        const { getMomentDetails, map } = this.props;
        const { momentId } = this.state;
        const moment = map?.moments[momentId];

        if (!moment) {
            getMomentDetails(this.state.momentId, {
                withMedia: true,
                withUser: true,
            }).then(({ moment: fetchedMoment }) => {
                document.title = `${fetchedMoment?.notificationMsg} | Therr App`;
            }).catch(() => {
                this.props.navigation.navigate('/');
            });
        } else {
            document.title = `${moment.notificationMsg} | Therr App`;
        }
    }

    handleShare = () => {
        const url = window.location.href;
        if (navigator.share) {
            navigator.share({ url }).catch(() => { /* ignore */ });
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                this.setState({ isLinkCopied: true });
                setTimeout(() => this.setState({ isLinkCopied: false }), 2000);
            }).catch(() => { /* ignore */ });
        }
    };

    login = (credentials: any) => this.props.login(credentials);

    renderSkeleton(): JSX.Element {
        return (
            <Container id="page_view_moment" size="lg" py="xl">
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

    renderBreadcrumbs(moment: any): JSX.Element {
        const items = [
            <Anchor href="/" key="home">{this.props.translate('pages.navigation.home')}</Anchor>,
            <Text key="moments" component="span">{this.props.translate('pages.navigation.moments')}</Text>,
            <Text key="title" component="span">{moment.notificationMsg}</Text>,
        ];

        return <Breadcrumbs className="moment-breadcrumbs">{items}</Breadcrumbs>;
    }

    renderHashTags(moment: any): JSX.Element | null {
        if (!moment.hashTags) return null;
        const tags = moment.hashTags.split(',').map((t: string) => t.trim()).filter(Boolean);
        if (tags.length === 0) return null;

        return (
            <Group gap="xs" mt="sm" wrap="wrap">
                {tags.map((tag: string) => (
                    <Badge key={tag} variant="light" size="sm">#{tag}</Badge>
                ))}
            </Group>
        );
    }

    renderAuthorInfo(moment: any): JSX.Element | null {
        const authorName = moment.fromUserFirstName && moment.fromUserLastName
            ? `${moment.fromUserFirstName} ${moment.fromUserLastName}`
            : '';
        if (!authorName) return null;

        return (
            <Group gap="xs" mt="xs">
                <Text size="sm" c="dimmed">{this.props.translate('pages.viewMoment.labels.postedBy')}</Text>
                {moment.fromUserId ? (
                    <Anchor href={`/users/${moment.fromUserId}`} size="sm">{authorName}</Anchor>
                ) : (
                    <Text size="sm">{authorName}</Text>
                )}
                {moment.createdAt && (
                    <Text size="sm" c="dimmed">
                        &middot; {new Date(moment.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </Text>
                )}
            </Group>
        );
    }

    renderSpaceCard(moment: any): JSX.Element | null {
        if (!moment.spaceId) return null;

        const space = moment.space;
        const spaceName = space?.notificationMsg || moment.areaTitle || this.props.translate('pages.viewMoment.labels.viewLocation');
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
            <Anchor href={`/spaces/${moment.spaceId}`} underline="never" className="moment-space-link">
                <Paper withBorder p="md" radius="md" className="moment-space-card">
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
        );
    }

    handleToggleMap = () => {
        this.setState((prevState) => ({ isMapVisible: !prevState.isMapVisible }));
    };

    renderLocationMap(moment: any): JSX.Element | null {
        const space = moment.space;
        const lat = space?.latitude || moment.latitude;
        const lng = space?.longitude || moment.longitude;

        if (!lat || !lng) return null;

        const { isMapVisible } = this.state;
        const mapLabel = space?.notificationMsg || moment.notificationMsg || '';
        const mapAddress = space?.addressReadable || '';

        return (
            <>
                <Group gap="sm" mt="xs">
                    <Anchor
                        component="button"
                        type="button"
                        size="sm"
                        onClick={this.handleToggleMap}
                    >
                        {isMapVisible
                            ? this.props.translate('pages.viewMoment.labels.hideMap')
                            : this.props.translate('pages.viewMoment.labels.showMap')}
                    </Anchor>
                    <Anchor
                        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                    >
                        {this.props.translate('pages.viewMoment.labels.viewOnGoogleMaps')}
                    </Anchor>
                </Group>
                {isMapVisible && (
                    <React.Suspense fallback={<Skeleton height={200} radius="md" mt="sm" />}>
                        <SpacesMap
                            spaces={[{
                                id: moment.spaceId || moment.id,
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
                )}
            </>
        );
    }

    public render(): JSX.Element {
        const { content, map } = this.props;
        const { momentId } = this.state;
        const moment = map?.moments[momentId];

        if (!moment) {
            return this.renderSkeleton();
        }

        // Use the cacheable api-gateway media endpoint when image is public otherwise fallback to signed url
        const mediaPath = (moment.medias?.[0]?.path);
        const mediaType = (moment.medias?.[0]?.type);
        const momentMedia = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
            ? getUserContentUri(moment.medias?.[0], 480, 480, true)
            : content?.media?.[mediaPath];

        const categoryLabel = formatCategoryLabel(moment.category);

        return (
            <Container id="page_view_moment" size="lg" py="xl">
                <Stack gap="md">
                    {/* Breadcrumbs */}
                    {this.renderBreadcrumbs(moment)}

                    {/* Hero Image */}
                    {momentMedia && (
                        <div className="moment-hero-image-wrapper">
                            <ProgressiveImage
                                src={momentMedia}
                                alt={moment.notificationMsg}
                                className="moment-hero-image"
                                fallbackSrc="/assets/images/meta-image-logo.png"
                                radius="md"
                                fetchPriority="high"
                            />
                        </div>
                    )}

                    {/* Title & Meta */}
                    <div className="moment-title-section">
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                            <Title order={1}>{moment.notificationMsg}</Title>
                            <Tooltip label={this.state.isLinkCopied ? this.props.translate('common.linkCopied') : this.props.translate('common.share')}>
                                <ActionIcon variant="subtle" size="lg" onClick={this.handleShare} aria-label="Share">
                                    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                    </svg>
                                </ActionIcon>
                            </Tooltip>
                        </Group>

                        <Group gap="sm" mt="xs" wrap="wrap">
                            {categoryLabel && (
                                <Badge variant="light" size="lg">{categoryLabel}</Badge>
                            )}
                        </Group>

                        {/* Author */}
                        {this.renderAuthorInfo(moment)}
                    </div>

                    {/* Space Card */}
                    {this.renderSpaceCard(moment)}

                    {/* Location Map */}
                    {this.renderLocationMap(moment)}

                    <Divider />

                    {/* Content / Description */}
                    {moment.message && (
                        <div className="moment-description">
                            <Text style={{ whiteSpace: 'pre-wrap' }}>{moment.message}</Text>
                            {this.renderHashTags(moment)}
                        </div>
                    )}
                </Stack>
            </Container>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(ViewMomentComponent)));
