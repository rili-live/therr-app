import * as React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Stack, Button } from '@mantine/core';
import useTranslation from '../hooks/useTranslation';
import { normalizeInviteUserName } from '../utilities/habitsSubdomainRoutes';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.therrmobile';
const APP_STORE_URL = 'https://apps.apple.com/us/app/therr/id1569988763?platform=iphone';

/**
 * Where "Join" sends the visitor. With no inviter (a bare /invite, or /invite/null from an app
 * build that shared a missing username) it is plain sign-up — `?invite-code=null` would hand
 * Register a code that belongs to nobody.
 */
export const getInviteJoinPath = (username: string) => (
    username ? `/register?invite-code=${encodeURIComponent(username)}` : '/register'
);

const InviteLanding: React.FC = () => {
    const { t: translate } = useTranslation();
    const params = useParams<{ username: string }>();
    const username = normalizeInviteUserName(params.username);
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = React.useState(false);
    const heading = username
        ? translate('pages.inviteLanding.title', { username })
        : translate('pages.inviteLanding.titleGeneric');

    React.useEffect(() => {
        document.title = `Therr | ${heading}`;

        if (typeof window !== 'undefined' && window.navigator) {
            const ua = window.navigator.userAgent.toLowerCase();
            setIsMobile(ua.indexOf('android') > -1 || ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1);
        }
    }, [heading]);

    const handleJoinClick = () => {
        navigate(getInviteJoinPath(username));
    };

    return (
        <div id="page_invite_landing" className="flex-box space-evenly center row wrap-reverse">
            <div className="register-container">
                <div className="flex fill max-wide-30">
                    <Stack gap="lg" align="center">
                        <h1 className="text-center">
                            {heading}
                        </h1>

                        <p className="text-center">
                            {translate('pages.inviteLanding.description')}
                        </p>

                        <Button
                            size="lg"
                            onClick={handleJoinClick}
                        >
                            {translate('pages.inviteLanding.joinButton')}
                        </Button>

                        {isMobile && (
                            <>
                                <p className="text-center">
                                    {translate('pages.inviteLanding.appStoreText')}
                                </p>
                                <div className="flex-box row space-evenly" style={{ gap: '1rem' }}>
                                    <a href={APP_STORE_URL} target="_blank" rel="noreferrer">
                                        <img
                                            src="/assets/images/apple-store-download-button.svg"
                                            alt="Download Therr on the App Store"
                                            className="max-100"
                                            width="150"
                                            height="50"
                                            loading="lazy"
                                        />
                                    </a>
                                    <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer">
                                        <img
                                            src="/assets/images/play-store-download-button.svg"
                                            alt="Download Therr on Google Play"
                                            className="max-100"
                                            width="150"
                                            height="50"
                                            loading="lazy"
                                        />
                                    </a>
                                </div>
                            </>
                        )}

                        <div className="text-center">
                            <Link to="/">{translate('pages.inviteLanding.returnHome')}</Link>
                        </div>
                    </Stack>
                </div>
            </div>
        </div>
    );
};

export default InviteLanding;
