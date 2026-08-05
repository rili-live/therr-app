import * as React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Stack, Button } from '@mantine/core';
import { BrandVariations } from 'therr-js-utilities/constants';
import { UsersService } from 'therr-react/services';
import { IUserState } from 'therr-react/types';
import useTranslation from '../hooks/useTranslation';
import { ApiAccessStage, getApiAccessStage, getDashboardTargetPath } from '../utilities/apiAccess';
import * as globalConfig from '../../../global-config';

const API_DOCS_URL = 'https://api.therr.com/v1/docs';

const STEP_KEYS = ['one', 'two', 'three', 'four'];

const ApiAccess: React.FC = () => {
    const { t: translate } = useTranslation();
    const user = useSelector((state: any) => state.user as IUserState);
    const [isHandingOff, setIsHandingOff] = React.useState(false);
    const [handoffError, setHandoffError] = React.useState('');

    // SSR has no session, so it always renders the unauthenticated CTA. Deferring the
    // real stage to an effect keeps the server and first client render identical and
    // avoids a hydration mismatch on a page that is CDN-cached for logged-out crawlers.
    const [stage, setStage] = React.useState<ApiAccessStage>(ApiAccessStage.UNAUTHENTICATED);

    React.useEffect(() => {
        setStage(getApiAccessStage(user));
    }, [user]);

    React.useEffect(() => {
        document.title = `Therr | ${translate('pages.apiAccess.pageTitle')}`;
    }, [translate]);

    const dashboardOrigin = globalConfig[process.env.NODE_ENV].dashboardHostFull;

    /**
     * Mints a single-use handoff code and lands the user directly on the dashboard page
     * they need. Without the returnTo the dashboard always drops them on /dashboard and
     * they have to find API keys themselves — the original dead end.
     */
    const navigateToDashboard = (targetPath: string) => {
        setHandoffError('');
        setIsHandingOff(true);

        // Opened synchronously inside the click gesture so the browser doesn't treat it
        // as a blocked popup once the async mint resolves (same approach as UserMenu).
        const newTab = window.open('', '_blank');
        if (newTab) {
            newTab.document.write('Loading dashboard…');
        }

        const rememberMe = user?.settings?.rememberMe ? '1' : '0';

        UsersService.mintHandoff(BrandVariations.DASHBOARD_THERR)
            .then((response) => {
                const { code } = response?.data || {};
                if (!code) {
                    throw new Error('Missing handoff code');
                }
                const dashboardUrl = `${dashboardOrigin}/sso?code=${encodeURIComponent(code)}`
                    + `&rm=${rememberMe}&returnTo=${encodeURIComponent(targetPath)}`;
                if (newTab) {
                    newTab.location.href = dashboardUrl;
                } else {
                    window.location.href = dashboardUrl;
                }
            })
            .catch(() => {
                // Never leave a blank tab hanging — send it somewhere it can recover from.
                const fallbackUrl = `${dashboardOrigin}/login?returnTo=${encodeURIComponent(targetPath)}`;
                if (newTab) {
                    newTab.location.href = fallbackUrl;
                } else {
                    setHandoffError(translate('pages.apiAccess.handoffError'));
                }
            })
            .finally(() => setIsHandingOff(false));
    };

    const renderCallToAction = () => {
        const dashboardTargetPath = getDashboardTargetPath(stage);

        if (dashboardTargetPath) {
            return (
                <Button
                    size="lg"
                    loading={isHandingOff}
                    onClick={() => navigateToDashboard(dashboardTargetPath)}
                >
                    {translate(`pages.apiAccess.cta.${stage}`)}
                </Button>
            );
        }

        if (stage === ApiAccessStage.INCOMPLETE_PROFILE) {
            return (
                <Button size="lg" component={Link} to="/create-profile?returnTo=%2Fapi-access">
                    {translate('pages.apiAccess.cta.incompleteProfile')}
                </Button>
            );
        }

        // Both remaining stages need a *business* account, which is created on the
        // dashboard (isBusinessAccount is set at dashboard registration). A consumer
        // account cannot be upgraded in place, so we send them to register there.
        return (
            <Button size="lg" component="a" href={`${dashboardOrigin}/register`}>
                {translate(`pages.apiAccess.cta.${stage}`)}
            </Button>
        );
    };

    return (
        <div id="page_api_access" className="flex-box space-evenly center row wrap-reverse">
            <div className="register-container">
                <div className="flex fill max-wide-30">
                    <Stack gap="md">
                        <h1 className="text-center">{translate('pages.apiAccess.pageTitle')}</h1>

                        <p className="text-center">{translate('pages.apiAccess.intro')}</p>

                        <ol>
                            {STEP_KEYS.map((stepKey) => (
                                <li key={stepKey}>
                                    <strong>{translate(`pages.apiAccess.steps.${stepKey}.title`)}</strong>
                                    <p>{translate(`pages.apiAccess.steps.${stepKey}.description`)}</p>
                                </li>
                            ))}
                        </ol>

                        <p className="text-center">{translate(`pages.apiAccess.status.${stage}`)}</p>

                        {handoffError && <p className="text-center">{handoffError}</p>}

                        <div className="text-center">
                            {renderCallToAction()}
                        </div>

                        <div className="text-center">
                            <a href={API_DOCS_URL} target="_blank" rel="noreferrer">
                                {translate('pages.apiAccess.viewDocs')}
                            </a>
                        </div>

                        <h3>{translate('pages.apiAccess.faqTitle')}</h3>
                        <p><strong>{translate('pages.apiAccess.faq.cost.question')}</strong></p>
                        <p>{translate('pages.apiAccess.faq.cost.answer')}</p>
                        <p><strong>{translate('pages.apiAccess.faq.lost.question')}</strong></p>
                        <p>{translate('pages.apiAccess.faq.lost.answer')}</p>
                        <p><strong>{translate('pages.apiAccess.faq.limit.question')}</strong></p>
                        <p>{translate('pages.apiAccess.faq.limit.answer')}</p>

                        <div className="text-center">
                            <Link to="/">{translate('pages.apiAccess.returnHome')}</Link>
                        </div>
                    </Stack>
                </div>
            </div>
        </div>
    );
};

export default ApiAccess;
