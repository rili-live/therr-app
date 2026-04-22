/* eslint-disable react/display-name */
/* eslint-disable arrow-body-style */
import * as React from 'react';
import { useSelector } from 'react-redux';
import translator from '../services/translator';

const withTranslation = (Component: any) => {
    return (props: any): any => {
        const locale = useSelector((state: any) => state.user?.settings?.locale || 'en-us');
        const translate = (key: string, params?: any) => translator(locale, key, params);
        return <Component {...props} translate={translate} locale={locale} />;
    };
};

export default withTranslation;
