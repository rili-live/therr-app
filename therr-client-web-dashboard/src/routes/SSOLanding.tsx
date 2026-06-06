import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UsersService } from 'therr-react/services';
import { BrandVariations } from 'therr-js-utilities/constants';

// Persists the handoff/login result and reloads so the Redux store
// re-initializes from storage on the dashboard's normal boot path.
const persistAndEnter = (
    userData: Record<string, any>,
    refreshToken: string | null,
    rememberMe: boolean,
) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('therrUser', JSON.stringify(userData));
    if (refreshToken) {
        storage.setItem('therrRefreshToken', refreshToken);
    }
    // Full reload so the Redux store re-initializes from storage
    window.location.href = '/dashboard';
};

const SSOLanding = () => {
    const navigate = useNavigate();
    const location = useLocation();

    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        const rememberMe = params.get('rm') === '1';
        const code = params.get('code');

        // Preferred path: exchange a single-use handoff code for a fresh,
        // dashboard-branded session. The code is the only credential in the URL
        // (no JWT/refresh token), and it's burned on redemption.
        if (code) {
            UsersService.redeemHandoff(code, BrandVariations.DASHBOARD_THERR)
                .then((response) => {
                    const data = response?.data || {};
                    if (!data.idToken || !data.refreshToken) {
                        throw new Error('Invalid handoff response');
                    }

                    persistAndEnter(
                        {
                            id: data.id,
                            idToken: data.idToken,
                            email: data.email || '',
                            firstName: data.firstName || '',
                            lastName: data.lastName || '',
                            userName: data.userName || '',
                            accessLevels: data.accessLevels || [],
                        },
                        data.refreshToken,
                        rememberMe,
                    );
                })
                .catch(() => {
                    navigate('/login');
                });
            return;
        }

        // Legacy fallback: tolerate an older web client that still passes the
        // token directly in the URL during a staged rollout. Safe to remove once
        // therr-client-web has shipped the handoff-code change everywhere.
        const token = params.get('token');
        const userId = params.get('userId');
        if (!token || !userId) {
            navigate('/login');
            return;
        }

        let accessLevels: string[] = [];
        try {
            accessLevels = JSON.parse(params.get('al') || '[]');
        } catch {
            accessLevels = [];
        }

        persistAndEnter(
            {
                id: userId,
                idToken: token,
                email: params.get('email') || '',
                firstName: params.get('fn') || '',
                lastName: params.get('ln') || '',
                userName: params.get('un') || '',
                accessLevels,
            },
            params.get('rt') || null,
            rememberMe,
        );
    }, []);

    return (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
            <p>Loading dashboard...</p>
        </div>
    );
};

export default SSOLanding;
