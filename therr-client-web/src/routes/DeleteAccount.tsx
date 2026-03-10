import * as React from 'react';
import { Link } from 'react-router-dom';
import { Stack } from '@mantine/core';
import translator from '../services/translator';

const translate = (key: string, params?: any) => translator('en-us', key, params);

const DeleteAccount: React.FC = () => {
    React.useEffect(() => {
        document.title = `Therr | ${translate('pages.deleteAccount.pageTitle')}`;
    }, []);

    return (
        <div id="page_delete_account" className="flex-box space-evenly center row wrap-reverse">
            <div className="register-container">
                <div className="flex fill max-wide-30">
                    <Stack gap="md">
                        <h1 className="text-center">{translate('pages.deleteAccount.pageTitle')}</h1>

                        <p>{translate('pages.deleteAccount.description')}</p>

                        <h3>{translate('pages.deleteAccount.optionMobileTitle')}</h3>
                        <ol>
                            <li>{translate('pages.deleteAccount.steps.openApp')}</li>
                            <li>{translate('pages.deleteAccount.steps.goToSettings')}</li>
                            <li>{translate('pages.deleteAccount.steps.manageAccount')}</li>
                            <li>{translate('pages.deleteAccount.steps.deleteAccount')}</li>
                            <li>{translate('pages.deleteAccount.steps.confirm')}</li>
                        </ol>

                        <h3>{translate('pages.deleteAccount.optionEmailTitle')}</h3>
                        <p>
                            {translate('pages.deleteAccount.emailInstructions')}{' '}
                            <a href="mailto:info@therr.com">info@therr.com</a>
                        </p>

                        <h3>{translate('pages.deleteAccount.dataDeletedTitle')}</h3>
                        <p>{translate('pages.deleteAccount.dataDeletedDescription')}</p>
                        <ul>
                            <li>{translate('pages.deleteAccount.dataItems.profile')}</li>
                            <li>{translate('pages.deleteAccount.dataItems.posts')}</li>
                            <li>{translate('pages.deleteAccount.dataItems.connections')}</li>
                            <li>{translate('pages.deleteAccount.dataItems.messages')}</li>
                            <li>{translate('pages.deleteAccount.dataItems.notifications')}</li>
                        </ul>

                        <p>{translate('pages.deleteAccount.retentionNote')}</p>

                        <div className="text-center">
                            <Link to="/login">{translate('pages.deleteAccount.returnToLogin')}</Link>
                        </div>
                    </Stack>
                </div>
            </div>
        </div>
    );
};

export default DeleteAccount;
