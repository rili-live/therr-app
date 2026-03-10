import * as React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Stack, Button } from '@mantine/core';
import translator from '../services/translator';

const translate = (key: string, params?: Record<string, string>) => translator('en-us', key, params);

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.therrmobile'; // eslint-disable-line max-len
const APP_STORE_URL = 'https://apps.apple.com/us/app/therr/id1569988763?platform=iphone'; // eslint-disable-line max-len

const InviteLanding: React.FC = () => {
    const { username } = useParams<{ username: string }>();
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        document.title = `Therr | ${translate('pages.inviteLanding.title', { username: username || '' })}`;

        if (typeof window !== 'undefined' && window.navigator) {
            const ua = window.navigator.userAgent.toLowerCase();
            setIsMobile(ua.indexOf('android') > -1 || ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1);
        }
    }, [username]);

    const handleJoinClick = () => {
        navigate(`/register?invite-code=${username}`);
    };

    return (
        <div id="page_invite_landing" className="flex-box space-evenly center row wrap-reverse">
            <div className="register-container">
                <div className="flex fill max-wide-30">
                    <Stack gap="lg" align="center">
                        <h1 className="text-center">
                            {translate('pages.inviteLanding.title', { username: username || '' })}
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
