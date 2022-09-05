import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import scrollTo from 'therr-js-utilities/scroll-to';

export default function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        // 'document.documentElement.scrollTo' is the magic for React Router Dom v6
        scrollTo(0, 100);
    }, [pathname]);

    return null;
}
