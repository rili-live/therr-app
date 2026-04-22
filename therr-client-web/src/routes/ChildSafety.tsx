import * as React from 'react';
import { Link } from 'react-router-dom';
import { Stack } from '@mantine/core';
import useTranslation from '../hooks/useTranslation';

const ChildSafety: React.FC = () => {
    const { t: translate } = useTranslation();

    React.useEffect(() => {
        document.title = `Therr | ${translate('pages.childSafety.pageTitle')}`;
    }, []);

    return (
        <div id="page_child_safety" className="flex-box space-evenly center row wrap-reverse">
            <div className="register-container">
                <div className="flex fill max-wide-30">
                    <Stack gap="md">
                        <h1 className="text-center">{translate('pages.childSafety.pageTitle')}</h1>

                        <p>{translate('pages.childSafety.intro')}</p>

                        <h3>{translate('pages.childSafety.zeroToleranceTitle')}</h3>
                        <p>{translate('pages.childSafety.zeroToleranceDescription')}</p>

                        <h3>{translate('pages.childSafety.preventionTitle')}</h3>
                        <ul>
                            <li>{translate('pages.childSafety.prevention.contentModeration')}</li>
                            <li>{translate('pages.childSafety.prevention.reporting')}</li>
                            <li>{translate('pages.childSafety.prevention.accountActions')}</li>
                            <li>{translate('pages.childSafety.prevention.lawEnforcement')}</li>
                            <li>{translate('pages.childSafety.prevention.ncmec')}</li>
                        </ul>

                        <h3>{translate('pages.childSafety.reportingTitle')}</h3>
                        <p>{translate('pages.childSafety.reportingInApp')}</p>
                        <p>
                            {translate('pages.childSafety.reportingEmail')}{' '}
                            <a href="mailto:info@therr.com">info@therr.com</a>
                        </p>

                        <h3>{translate('pages.childSafety.complianceTitle')}</h3>
                        <p>{translate('pages.childSafety.complianceDescription')}</p>

                        <h3>{translate('pages.childSafety.contactTitle')}</h3>
                        <p>
                            {translate('pages.childSafety.contactDescription')}{' '}
                            <a href="mailto:info@therr.com">info@therr.com</a>
                        </p>

                        <div className="text-center">
                            <Link to="/">{translate('pages.childSafety.returnHome')}</Link>
                        </div>
                    </Stack>
                </div>
            </div>
        </div>
    );
};

export default ChildSafety;
