import { useSelector } from 'react-redux';
import translator from '../services/translator';

const useTranslation = () => {
    const locale = useSelector((state: any) => state.user?.settings?.locale || 'en-us');
    const t = (key: string, params?: any) => translator(locale, key, params);
    return { t, locale };
};

export default useTranslation;
