import * as React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Stack } from '@mantine/core';
import useTranslation from '../hooks/useTranslation';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.therrmobile';
const APP_STORE_URL = 'https://apps.apple.com/us/app/therr/id1569988763?platform=iphone';

const ClaimPactLanding: React.FC = () => {
    const { t: translate } = useTranslation();
    const { token } = useParams<{ token: string }>();
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        document.title = `Friends with Habits | ${translate('pages.claimPactLanding.title')}`;

        if (typeof window !== 'undefined' && window.navigator) {
            const ua = window.navigator.userAgent.toLowerCase();
            setIsMobile(ua.indexOf('android') > -1 || ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1);
        }
    }, [translate]);

    return (
        <div id="page_claim_pact_landing" className="flex-box space-evenly center row wrap-reverse">
            <div className="register-container">
                <div className="flex fill max-wide-30">
                    <Stack gap="lg" align="center">
                        <h1 className="text-center">
                            {translate('pages.claimPactLanding.title')}
                        </h1>

                        <p className="text-center">
                            {translate('pages.claimPactLanding.description')}
                        </p>

                        <p className="text-center">
                            {translate('pages.claimPactLanding.instructions')}
                        </p>

                        {isMobile && (
                            <div className="flex-box row space-evenly" style={{ gap: '1rem' }}>
                                <a href={APP_STORE_URL} target="_blank" rel="noreferrer">
                                    <img
                                        src="/assets/images/apple-store-download-button.svg"
                                        alt="Download Friends with Habits on the App Store"
                                        className="max-100"
                                        width="150"
                                        height="50"
                                        loading="lazy"
                                    />
                                </a>
                                <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer">
                                    <img
                                        src="/assets/images/play-store-download-button.svg"
                                        alt="Download Friends with Habits on Google Play"
                                        className="max-100"
                                        width="150"
                                        height="50"
                                        loading="lazy"
                                    />
                                </a>
                            </div>
                        )}

                        {token && (
                            <p className="text-center" style={{ wordBreak: 'break-all' }}>
                                <small>{translate('pages.claimPactLanding.tokenLabel')}: {token}</small>
                            </p>
                        )}

                        <div className="text-center">
                            <Link to="/">{translate('pages.claimPactLanding.returnHome')}</Link>
                        </div>
                    </Stack>
                </div>
            </div>
        </div>
    );
};

export default ClaimPactLanding;
