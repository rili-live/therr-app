import * as React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Stack } from '@mantine/core';
import ReactGA from 'react-ga4';
import useTranslation from '../hooks/useTranslation';

// Friends with Habits applicationId — NOT the Therr app. Sending a pact
// invitee to the Therr listing would install an app that cannot claim the
// pact. (No HABITS iOS app exists yet; re-add the App Store badge with the
// HABITS bundle once it ships.)
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.therr.habits';

const ClaimPactLanding: React.FC = () => {
    const { t: translate } = useTranslation();
    const { token } = useParams<{ token: string }>();

    React.useEffect(() => {
        document.title = `Friends with Habits | ${translate('pages.claimPactLanding.title')}`;
    }, [translate]);

    // The HABITS claim flow, which is a separate funnel from the B2B space
    // claim: an invitee lands here from a pact invite and has to leave the web
    // entirely to finish. The store click is therefore the last thing this
    // property can observe, and the gap between the two events is the whole
    // drop-off — measured once here rather than inferred from install counts.
    React.useEffect(() => {
        ReactGA.event('pact_claim_landing_view', {
            hasToken: !!token,
        });
    }, [token]);

    const onStoreClick = () => {
        ReactGA.event('pact_claim_store_click', {
            hasToken: !!token,
            store: 'play',
        });
    };

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

                        <div className="flex-box row space-evenly" style={{ gap: '1rem' }}>
                            <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer" onClick={onStoreClick}>
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
