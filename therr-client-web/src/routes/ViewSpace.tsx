/* eslint-disable max-len, react/jsx-no-target-blank, class-methods-use-this */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { ContentActions, MapActions } from 'therr-react/redux/actions';
import { MapsService } from 'therr-react/services';
import { IContentState, IMapState, IUserState } from 'therr-react/types';
import { IconCheck } from '@tabler/icons-react';
import { Categories, Content } from 'therr-js-utilities/constants';
import {
    ActionIcon, Container, Stack, Group, Title, Text, Badge, Anchor,
    Divider, Image, Skeleton, Breadcrumbs, Tooltip,
    SimpleGrid, Rating as MantineRating, Paper, Avatar,
    Button, Alert, Modal, Textarea, Collapse, List, ThemeIcon,
} from '@mantine/core';
import { InlineSvg } from 'therr-react/components';
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

const formatPriceRange = (priceRange: number): string => '$'.repeat(priceRange);

const parseOpeningHours = (schema: string[]): { days: string; hours: string }[] => schema.map((entry) => {
    const parts = entry.split(' ');
    return {
        days: parts[0] || '',
        hours: parts.slice(1).join(' ') || '',
    };
});

interface IViewSpaceRouterProps {
    location: {
        search: string;
    };
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: {
        spaceId: string;
    }
}

interface IViewSpaceDispatchProps {
    createOrUpdateSpaceReaction: Function;
    getSpaceDetails: Function;
}

interface IStoreProps extends IViewSpaceDispatchProps {
    content: IContentState;
    map: IMapState;
    user: IUserState;
}

// Regular component props
interface IViewSpaceProps extends IViewSpaceRouterProps, IStoreProps {
    locale: string;
    translate: (key: string, params?: any) => string;
}

interface IViewSpaceState {
    spaceId: string;
    spaceMoments: any[];
    isMomentsLoading: boolean;
    spacePairings: any[];
    isPairingsLoading: boolean;
    pairingFeedback: { [id: string]: boolean };
    isLinkCopied: boolean;
    isFromCheckin: boolean;
    isFromClaimEmail: boolean;
    isClaimLoading: boolean;
    claimMessage: string;
    claimMessageType: 'success' | 'error' | '';
    isClaimBannerDismissed: boolean;
    isCheckinBannerDismissed: boolean;
    isWhyTherrExpanded: boolean;
    isLoginModalOpen: boolean;
    loginModalAction: 'bookmark' | 'review' | '';
    reviewRating: number;
    reviewMessage: string;
    isReviewSubmitting: boolean;
    reviewError: string;
    reviewSuccess: string;
    userLatitude: number | null;
    userLongitude: number | null;
    isLocationLoading: boolean;
    locationError: string;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    map: state.map,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createOrUpdateSpaceReaction: ContentActions.createOrUpdateSpaceReaction,
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

        const searchParams = new URLSearchParams(props.location?.search || '');

        this.state = {
            spaceId: props.routeParams.spaceId,
            spaceMoments: [],
            isMomentsLoading: false,
            spacePairings: [],
            isPairingsLoading: false,
            pairingFeedback: {},
            isLinkCopied: false,
            isFromCheckin: searchParams.get('checkin') === 'true',
            isFromClaimEmail: searchParams.get('claim') === 'true',
            isClaimBannerDismissed: false,
            isCheckinBannerDismissed: false,
            isWhyTherrExpanded: false,
            isClaimLoading: false,
            claimMessage: '',
            claimMessageType: '',
            isLoginModalOpen: false,
            loginModalAction: '',
            reviewRating: 0,
            reviewMessage: '',
            isReviewSubmitting: false,
            reviewError: '',
            reviewSuccess: '',
            userLatitude: null,
            userLongitude: null,
            isLocationLoading: false,
            locationError: '',
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
                if (this.state.isFromClaimEmail) {
                    // Allow a render cycle for the claim section to mount
                    requestAnimationFrame(() => this.scrollToClaimSection());
                }
            }).catch(() => {
                this.props.navigation.navigate('/');
            });
        } else {
            document.title = `${space.notificationMsg} | Therr App`;
            this.fetchSpaceMoments(spaceId);
            this.fetchSpacePairings(spaceId);
            if (this.state.isFromClaimEmail) {
                requestAnimationFrame(() => this.scrollToClaimSection());
            }
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

    scrollToClaimSection = () => {
        document.getElementById('claim-space-section')?.scrollIntoView({ behavior: 'smooth' });
    };

    // Builds the returnTo path for login/register links, preserving ?checkin=true when present
    // so the check-in intent survives the full auth + profile-creation flow.
    getReturnToPath = (id: string) => {
        const { isFromCheckin } = this.state;
        return isFromCheckin ? `/spaces/${id}?checkin=true` : `/spaces/${id}`;
    };

    handleClaimSpace = () => {
        const { user, translate } = this.props;
        const { spaceId } = this.state;

        if (!user?.isAuthenticated) {
            this.props.navigation.navigate(`/register?returnTo=${encodeURIComponent(this.getReturnToPath(spaceId))}`);
            return;
        }

        this.setState({ isClaimLoading: true, claimMessage: '', claimMessageType: '' });
        MapsService.claimSpace(spaceId)
            .then(() => {
                this.setState({
                    isClaimLoading: false,
                    claimMessage: translate('pages.viewSpace.claimSpace.successMessage'),
                    claimMessageType: 'success',
                });
            })
            .catch(() => {
                this.setState({
                    isClaimLoading: false,
                    claimMessage: translate('pages.viewSpace.claimSpace.errorMessage'),
                    claimMessageType: 'error',
                });
            });
    };

    handleBookmarkPress = () => {
        const { createOrUpdateSpaceReaction, map, user } = this.props;
        const { spaceId } = this.state;
        const space = map?.spaces[spaceId];

        if (!user?.isAuthenticated) {
            this.setState({ isLoginModalOpen: true, loginModalAction: 'bookmark' });
            return;
        }

        const reactionData: any = {
            userBookmarkCategory: space?.reaction?.userBookmarkCategory ? null : 'Uncategorized',
            spaceId: space?.id,
        };
        createOrUpdateSpaceReaction(space?.id, reactionData, space?.fromUserId, user?.details?.userName);
    };

    handleRequestLocation = () => {
        if (typeof window === 'undefined' || !navigator.geolocation) {
            this.setState({ locationError: this.props.translate('pages.viewSpace.addReview.locationUnavailable') });
            return;
        }

        this.setState({ isLocationLoading: true, locationError: '' });
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.setState({
                    userLatitude: position.coords.latitude,
                    userLongitude: position.coords.longitude,
                    isLocationLoading: false,
                    locationError: '',
                });
            },
            () => {
                this.setState({
                    isLocationLoading: false,
                    locationError: this.props.translate('pages.viewSpace.addReview.locationDenied'),
                });
            },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    };

    getDistanceToSpace = (): number | null => {
        const { map } = this.props;
        const { spaceId, userLatitude, userLongitude } = this.state;
        const space = map?.spaces[spaceId];

        if (userLatitude == null || userLongitude == null || !space?.latitude || !space?.longitude) {
            return null;
        }

        const R = 6371e3; // Earth radius in meters
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const dLat = toRad(space.latitude - userLatitude);
        const dLon = toRad(space.longitude - userLongitude);
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(toRad(userLatitude)) * Math.cos(toRad(space.latitude)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    handleSubmitReview = () => {
        const {
            createOrUpdateSpaceReaction, map, user, translate,
        } = this.props;
        const { spaceId, reviewRating, reviewMessage } = this.state;
        const space = map?.spaces[spaceId];

        if (!user?.isAuthenticated) {
            this.setState({ isLoginModalOpen: true, loginModalAction: 'review' });
            return;
        }

        if (reviewRating === 0) {
            this.setState({ reviewError: translate('pages.viewSpace.addReview.ratingRequired') });
            return;
        }

        this.setState({ isReviewSubmitting: true, reviewError: '', reviewSuccess: '' });

        // Submit rating via space reaction
        const ratingPromise = createOrUpdateSpaceReaction(
            space?.id,
            { spaceId: space?.id, rating: reviewRating },
            space?.fromUserId,
            user?.details?.userName,
        );

        // Create moment linked to space if message is provided
        const momentPromise = reviewMessage.trim()
            ? MapsService.createMoment({
                fromUserId: Number(user?.details?.id),
                locale: this.props.locale || 'en-us',
                isPublic: true,
                message: reviewMessage.trim(),
                notificationMsg: `Review of ${space?.notificationMsg || ''}`.substring(0, 100),
                latitude: String(this.state.userLatitude),
                longitude: String(this.state.userLongitude),
                spaceId,
            } as any)
            : Promise.resolve(null);

        Promise.all([ratingPromise, momentPromise])
            .then(() => {
                this.setState({
                    isReviewSubmitting: false,
                    reviewSuccess: translate('pages.viewSpace.addReview.successMessage'),
                    reviewRating: 0,
                    reviewMessage: '',
                });
                // Refresh moments list
                this.fetchSpaceMoments(spaceId);
            })
            .catch(() => {
                this.setState({
                    isReviewSubmitting: false,
                    reviewError: translate('pages.viewSpace.addReview.errorMessage'),
                });
            });
    };

    renderLoginModal(): JSX.Element {
        const { translate } = this.props;
        const { spaceId, isLoginModalOpen } = this.state;

        return (
            <Modal
                opened={isLoginModalOpen}
                onClose={() => this.setState({ isLoginModalOpen: false, loginModalAction: '' })}
                title={translate('pages.viewSpace.loginModal.title')}
                centered
            >
                <Text size="sm" mb="lg">
                    {translate('pages.viewSpace.loginModal.body')}
                </Text>
                <Group justify="center" gap="md">
                    <Button
                        component="a"
                        href={`/login?returnTo=${encodeURIComponent(this.getReturnToPath(spaceId))}`}
                        variant="filled"
                        color="teal"
                    >
                        {translate('pages.viewSpace.loginModal.signIn')}
                    </Button>
                    <Button
                        component="a"
                        href={`/register?returnTo=${encodeURIComponent(this.getReturnToPath(spaceId))}`}
                        variant="outline"
                        color="teal"
                    >
                        {translate('pages.viewSpace.loginModal.register')}
                    </Button>
                </Group>
            </Modal>
        );
    }

    renderAddReviewContent(): JSX.Element {
        const { translate } = this.props;
        const {
            reviewRating, reviewMessage, isReviewSubmitting,
            reviewError, reviewSuccess, userLatitude,
            isLocationLoading, locationError,
        } = this.state;

        if (reviewSuccess) {
            return (
                <Alert color="green" radius="md">
                    <Text fw={500}>{reviewSuccess}</Text>
                    <Anchor
                        component="button"
                        type="button"
                        size="sm"
                        mt="xs"
                        display="inline-block"
                        onClick={() => this.setState({ reviewSuccess: '' })}
                    >
                        {translate('pages.viewSpace.addReview.writeAnother')}
                    </Anchor>
                </Alert>
            );
        }

        const MAX_REVIEW_DISTANCE_METERS = 200;
        const distance = this.getDistanceToSpace();
        const isNearby = distance !== null && distance <= MAX_REVIEW_DISTANCE_METERS;
        const hasLocation = userLatitude != null;

        return (
            <>
                {!hasLocation && (
                    <>
                        <Text size="sm" c="dimmed" mb="sm">
                            {translate('pages.viewSpace.addReview.locationPrompt')}
                        </Text>
                        <Button
                            onClick={this.handleRequestLocation}
                            loading={isLocationLoading}
                            variant="light"
                            color="teal"
                            size="sm"
                            mb="sm"
                        >
                            {translate('pages.viewSpace.addReview.enableLocation')}
                        </Button>
                        {locationError && (
                            <Text size="sm" c="red" mb="sm">{locationError}</Text>
                        )}
                    </>
                )}

                {hasLocation && !isNearby && (
                    <>
                        <Alert color="yellow" radius="md" mb="sm">
                            <Text size="sm">
                                {translate('pages.viewSpace.addReview.tooFar')}
                            </Text>
                        </Alert>
                        <Button
                            onClick={this.handleRequestLocation}
                            loading={isLocationLoading}
                            variant="light"
                            color="teal"
                            size="sm"
                            mb="sm"
                        >
                            {translate('pages.viewSpace.addReview.retryLocation')}
                        </Button>
                    </>
                )}

                {hasLocation && isNearby && (
                    <>
                        <Group gap="xs" mb="sm">
                            <Text size="sm" fw={500}>{translate('pages.viewSpace.addReview.yourRating')}</Text>
                            <MantineRating
                                value={reviewRating}
                                onChange={isReviewSubmitting ? undefined : (val) => this.setState({ reviewRating: val, reviewError: '' })}
                                size="lg"
                            />
                        </Group>
                        <Textarea
                            placeholder={translate('pages.viewSpace.addReview.messagePlaceholder')}
                            value={reviewMessage}
                            onChange={(e) => this.setState({ reviewMessage: e.currentTarget.value })}
                            disabled={isReviewSubmitting}
                            minRows={3}
                            maxRows={6}
                            mb="sm"
                        />
                        {reviewError && (
                            <Text size="sm" c="red" mb="sm">{reviewError}</Text>
                        )}
                        <Button
                            onClick={this.handleSubmitReview}
                            loading={isReviewSubmitting}
                            variant="filled"
                            color="teal"
                        >
                            {translate('pages.viewSpace.addReview.submitButton')}
                        </Button>
                    </>
                )}
            </>
        );
    }

    renderAddReview(space: any): JSX.Element | null {
        const { user, translate } = this.props;
        const isAuthenticated = user?.isAuthenticated;

        // Cannot verify proximity without space coordinates
        if (!space.latitude || !space.longitude) {
            return null;
        }

        return (
            <Paper withBorder p="lg" radius="md" mt="lg">
                <Title order={3} size="h4" mb="sm">{translate('pages.viewSpace.addReview.title')}</Title>
                {!isAuthenticated ? (
                    <>
                        <Text size="sm" c="dimmed" mb="sm">
                            {translate('pages.viewSpace.addReview.signInPrompt')}
                        </Text>
                        <Button
                            onClick={() => this.setState({ isLoginModalOpen: true, loginModalAction: 'review' })}
                            variant="light"
                            color="teal"
                            size="sm"
                        >
                            {translate('pages.viewSpace.loginModal.signIn')}
                        </Button>
                    </>
                ) : (
                    this.renderAddReviewContent()
                )}
            </Paper>
        );
    }

    renderClaimEmailBanner(space: any): JSX.Element | null {
        const { translate } = this.props;
        const { isFromClaimEmail, isClaimBannerDismissed, claimMessageType } = this.state;

        if (!isFromClaimEmail || isClaimBannerDismissed || !space.isUnclaimed || claimMessageType === 'success') {
            return null;
        }

        return (
            <Alert
                color="teal"
                radius="md"
                withCloseButton
                onClose={() => this.setState({ isClaimBannerDismissed: true })}
                title={translate('pages.viewSpace.claimSpace.emailTitle')}
            >
                <Text size="sm" mb="sm">{translate('pages.viewSpace.claimSpace.emailBody')}</Text>
                <Button
                    onClick={this.scrollToClaimSection}
                    variant="filled"
                    size="compact-md"
                    color="teal"
                >
                    {translate('pages.viewSpace.claimSpace.claimButton')}
                </Button>
            </Alert>
        );
    }

    renderCheckinBanner(space: any): JSX.Element | null {
        const { user, translate } = this.props;
        const { isFromCheckin, isCheckinBannerDismissed } = this.state;

        if (!isFromCheckin || isCheckinBannerDismissed) {
            return null;
        }

        const businessName = space?.notificationMsg;
        const isAuthenticated = !!user?.isAuthenticated;

        return (
            <Alert
                color="teal"
                radius="md"
                withCloseButton
                onClose={() => this.setState({ isCheckinBannerDismissed: true })}
                title={translate('pages.viewSpace.checkinBanner.title')}
            >
                <Text size="sm" mb="sm">
                    {isAuthenticated
                        ? translate('pages.viewSpace.checkinBanner.bodyLoggedIn', { businessName })
                        : translate('pages.viewSpace.checkinBanner.body', { businessName })}
                </Text>
                <Group gap="xs" mb="xs" className="store-image-links">
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
                {!isAuthenticated && (
                    <Text size="xs" c="dimmed">
                        {translate('pages.viewSpace.checkinBanner.orSignUp')}{' '}
                        <Anchor href={`/register?returnTo=${encodeURIComponent(this.getReturnToPath(space.id))}`} size="xs">
                            {translate('pages.viewSpace.checkinBanner.signUpLink')}
                        </Anchor>
                    </Text>
                )}
            </Alert>
        );
    }

    renderClaimSubtleCTA(space: any): JSX.Element | null {
        const { user, translate } = this.props;
        const { isFromClaimEmail } = this.state;
        const isAuthenticated = user?.isAuthenticated;
        const isOwner = isAuthenticated && user?.details?.id === space.fromUserId;

        if (!space.isUnclaimed && isOwner) {
            return (
                <Button
                    component="a"
                    href={`/spaces/${space.id}/edit`}
                    variant="subtle"
                    size="compact-sm"
                >
                    {translate('pages.viewSpace.claimSpace.editButton')}
                </Button>
            );
        }

        if (space.isUnclaimed && !space.isClaimPending && !space.requestedByUserId) {
            if (isFromClaimEmail) {
                return (
                    <Button
                        onClick={this.scrollToClaimSection}
                        variant="light"
                        size="compact-sm"
                        color="teal"
                    >
                        {translate('pages.viewSpace.claimSpace.subtleCTA')}
                    </Button>
                );
            }

            return (
                <Anchor onClick={this.scrollToClaimSection} size="xs" c="dimmed" style={{ cursor: 'pointer' }}>
                    {translate('pages.viewSpace.claimSpace.subtleCTA')}
                </Anchor>
            );
        }

        return null;
    }

    renderClaimCTA(space: any): JSX.Element | null {
        const { user, translate } = this.props;
        const {
            isFromClaimEmail, isClaimLoading, claimMessage, claimMessageType, isWhyTherrExpanded,
        } = this.state;
        const isAuthenticated = user?.isAuthenticated;

        if (claimMessageType === 'success') {
            return (
                <Alert color="green" radius="md" mt="md" id="claim-space-section">
                    <Text fw={500}>{claimMessage}</Text>
                </Alert>
            );
        }

        if (space.isClaimPending || space.requestedByUserId) {
            return (
                <Paper withBorder p="lg" radius="md" mt="md" id="claim-space-section" style={{ borderColor: 'var(--therr-cta-pending-border)', backgroundColor: 'var(--therr-cta-pending-bg)', color: 'var(--therr-cta-pending-text)' }}>
                    <Text fw={600} size="lg" c="inherit">{translate('pages.viewSpace.claimSpace.pendingTitle')}</Text>
                    <Text size="sm" mt="xs" c="dimmed">{translate('pages.viewSpace.claimSpace.pendingBody')}</Text>
                </Paper>
            );
        }

        if (!space.isUnclaimed) {
            return null;
        }

        return (
            <Paper
                withBorder
                p={isFromClaimEmail ? 'xl' : 'lg'}
                radius="md"
                mt="md"
                id="claim-space-section"
                style={{
                    borderColor: 'var(--therr-cta-border)',
                    backgroundColor: isFromClaimEmail ? 'var(--therr-cta-bg-emphasis)' : 'var(--therr-cta-bg)',
                    borderWidth: isFromClaimEmail ? 2 : 1,
                    color: 'var(--therr-cta-text)',
                }}
            >
                <Title order={isFromClaimEmail ? 2 : 3} size={isFromClaimEmail ? 'h3' : 'h4'} c="inherit">
                    {translate(isFromClaimEmail ? 'pages.viewSpace.claimSpace.emailTitle' : 'pages.viewSpace.claimSpace.title')}
                </Title>
                <Text size={isFromClaimEmail ? 'md' : 'sm'} mt="xs" c="inherit">
                    {translate(isFromClaimEmail ? 'pages.viewSpace.claimSpace.emailBody' : 'pages.viewSpace.claimSpace.body')}
                </Text>
                <Anchor
                    size="sm"
                    mt="sm"
                    display="inline-block"
                    onClick={() => this.setState((prev) => ({ isWhyTherrExpanded: !prev.isWhyTherrExpanded }))}
                >
                    {translate('pages.viewSpace.claimSpace.whyTherr.toggle')}
                    {' '}
                    {isWhyTherrExpanded ? '▲' : '▼'}
                </Anchor>
                <Collapse in={isWhyTherrExpanded}>
                    <List
                        mt="sm"
                        spacing="xs"
                        size="sm"
                        icon={(
                            <ThemeIcon color="teal" size={18} radius="xl">
                                <IconCheck size={12} />
                            </ThemeIcon>
                        )}
                    >
                        {[1, 2, 3, 4, 5].map((n) => (
                            <List.Item key={n}>
                                <Text size="sm" fw={600} span>{translate(`pages.viewSpace.claimSpace.whyTherr.item${n}Title`)}</Text>
                                {' — '}
                                <Text size="sm" span>{translate(`pages.viewSpace.claimSpace.whyTherr.item${n}Body`)}</Text>
                            </List.Item>
                        ))}
                    </List>
                </Collapse>
                {claimMessage && claimMessageType === 'error' && (
                    <Text size="sm" c="red" mt="xs">{claimMessage}</Text>
                )}
                <Group mt="md" gap="md" wrap="wrap">
                    {isAuthenticated ? (
                        <Button
                            onClick={this.handleClaimSpace}
                            loading={isClaimLoading}
                            variant="filled"
                            size="md"
                            color="teal"
                        >
                            {translate('pages.viewSpace.claimSpace.claimButton')}
                        </Button>
                    ) : (
                        <>
                            <Button
                                component="a"
                                href={`/register?returnTo=${encodeURIComponent(this.getReturnToPath(space.id))}`}
                                variant="filled"
                                size="md"
                                color="teal"
                            >
                                {translate('pages.viewSpace.claimSpace.claimButton')}
                            </Button>
                            <Anchor href={`/login?returnTo=${encodeURIComponent(this.getReturnToPath(space.id))}`} size="sm">
                                {translate('pages.viewSpace.claimSpace.alreadyHaveAccount')}
                            </Anchor>
                        </>
                    )}
                </Group>
            </Paper>
        );
    }

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
        const lat = space.latitude;
        const lng = space.longitude;

        if (!hasAddress && !space.phoneNumber && !lat && !lng) return null;

        return (
            <>
                <Title order={3} size="h4" mt="lg">{this.props.translate('pages.viewSpace.headings.contactAndLocation')}</Title>
                {hasAddress && (
                    <address className="space-address">
                        {space.addressStreetAddress && <Text>{space.addressStreetAddress}</Text>}
                        {(space.addressLocality || space.addressRegion) && (
                            <Text>
                                {[space.addressLocality, space.addressRegion].filter(Boolean).join(', ')}
                                {space.postalCode ? ` ${space.postalCode}` : ''}
                            </Text>
                        )}
                        {space.region && <Text>{space.region}</Text>}
                    </address>
                )}
                {space.phoneNumber && (
                    <Text mt="xs">
                        <Anchor href={`tel:${space.phoneNumber}`}>{space.phoneNumber}</Anchor>
                    </Text>
                )}
                {lat && lng && (
                    <>
                        <React.Suspense fallback={<Skeleton height={250} radius="md" mt="sm" />}>
                            <SpacesMap
                                spaces={[{
                                    id: space.id,
                                    notificationMsg: space.notificationMsg,
                                    addressReadable: space.addressReadable,
                                    latitude: lat,
                                    longitude: lng,
                                }]}
                                centerLat={lat}
                                centerLng={lng}
                                localePrefix={({ es: '/es', 'fr-ca': '/fr' } as Record<string, string>)[this.props.locale] || ''}
                                zoom={15}
                                height={250}
                                interactive={false}
                            />
                        </React.Suspense>
                        <Anchor
                            href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                            target="_blank"
                            mt="xs"
                            display="inline-block"
                        >
                            {this.props.translate('pages.viewSpace.labels.viewOnGoogleMaps')}
                        </Anchor>
                    </>
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
        const categorySlug = Categories.CategorySlugMap[space.category];
        const hasRating = space.rating?.avgRating != null && space.rating.avgRating > 0;

        return (
            <Container id="page_view_space" size="lg" py="xl">
                <Stack gap="md">
                    {/* Claim Email Banner — shown when arriving via unclaimed space outreach email */}
                    {this.renderClaimEmailBanner(space)}

                    {/* QR Check-in Banner — shown when arriving via a physical display kit QR code */}
                    {this.renderCheckinBanner(space)}

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
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                            <div style={{ minWidth: 0 }}>
                                <Title order={1}>
                                    {space.notificationMsg}
                                    {space.addressReadable && (
                                        <span style={{ fontWeight: 300 }}>{` - ${space.addressReadable}`}</span>
                                    )}
                                </Title>
                                {this.renderClaimSubtleCTA(space)}
                            </div>
                            <Group gap="xs">
                                <Tooltip label={space.reaction?.userBookmarkCategory ? this.props.translate('pages.viewSpace.labels.removeBookmark') : this.props.translate('pages.viewSpace.labels.bookmark')}>
                                    <ActionIcon variant="subtle" size="lg" onClick={this.handleBookmarkPress} aria-label="Bookmark" color={space.reaction?.userBookmarkCategory ? 'teal' : 'gray'} className="space-bookmark-icon">
                                        <InlineSvg
                                            name={space.reaction?.userBookmarkCategory ? 'bookmark' : 'bookmark-border'}
                                        />
                                    </ActionIcon>
                                </Tooltip>
                                <Tooltip label={this.state.isLinkCopied ? this.props.translate('common.linkCopied') : this.props.translate('common.share')}>
                                    <ActionIcon variant="subtle" size="lg" onClick={this.handleShare} aria-label="Share">
                                        <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                        </svg>
                                    </ActionIcon>
                                </Tooltip>
                            </Group>
                        </Group>
                        {space.addressReadable && !space.notificationMsg && (
                            <Title order={2} size="h4" c="dimmed" fw={400}>{space.addressReadable}</Title>
                        )}

                        <Group gap="sm" mt="xs" wrap="wrap">
                            {categoryLabel && (
                                categorySlug
                                    ? (
                                        <Anchor href={`/locations/${categorySlug}`} underline="never">
                                            <Badge variant="light" size="lg" style={{ cursor: 'pointer' }}>{categoryLabel}</Badge>
                                        </Anchor>
                                    )
                                    : <Badge variant="light" size="lg">{categoryLabel}</Badge>
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

                    {/* Add Review */}
                    {/* TODO: Review submission is disabled on web for now. Our anti-fake-content strategy */}
                    {/* relies on location verification, which is clunky on web browsers compared to mobile. */}
                    {/* A separate PR is in progress to improve visited-space tracking. Once we can reliably */}
                    {/* determine that a user has visited a space (via check-in data), we can re-enable */}
                    {/* reviews on both web and mobile without requiring real-time geolocation proximity. */}
                    {/* To re-enable: uncomment the line below */}
                    {/* {this.renderAddReview(space)} */}

                    {/* Community Posts (Moments) */}
                    {this.renderCommunityPosts()}

                    {/* Local (Pairings) */}
                    {this.renderPairings()}

                    {/* Claim This Space CTA */}
                    {this.renderClaimCTA(space)}

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
                {this.renderLoginModal()}
            </Container>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(ViewSpaceComponent)));
