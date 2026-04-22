import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const SSOLanding = () => {
    const navigate = useNavigate();
    const location = useLocation();

    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        const userId = params.get('userId');

        if (!token || !userId) {
            navigate('/login');
            return;
        }

        const rememberMe = params.get('rm') === '1';
        const refreshToken = params.get('rt') || null;

        let accessLevels: string[] = [];
        try {
            accessLevels = JSON.parse(params.get('al') || '[]');
        } catch {
            accessLevels = [];
        }

        const userData = {
            id: userId,
            idToken: token,
            email: params.get('email') || '',
            firstName: params.get('fn') || '',
            lastName: params.get('ln') || '',
            userName: params.get('un') || '',
            accessLevels,
        };

        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('therrUser', JSON.stringify(userData));
        if (refreshToken) {
            storage.setItem('therrRefreshToken', refreshToken);
        }

        // Full reload so the Redux store re-initializes from storage
        window.location.href = '/dashboard';
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
            <p>Loading dashboard...</p>
        </div>
    );
};

export default SSOLanding;
