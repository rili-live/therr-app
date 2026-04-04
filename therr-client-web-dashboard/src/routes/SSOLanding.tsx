import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction, useNavigate, useLocation } from 'react-router-dom';
import { IUserState } from 'therr-react/types';
import UsersActions from '../redux/actions/UsersActions';

interface ISSOLandingDispatchProps {
    login: Function;
}

interface IStoreProps extends ISSOLandingDispatchProps {
    user: IUserState;
}

interface ISSOLandingProps extends IStoreProps {
    navigation: { navigate: NavigateFunction };
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    login: UsersActions.login,
}, dispatch);

const SSOLandingComponent = ({ user }: ISSOLandingProps) => {
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

        // Full reload so the store re-initializes from localStorage
        window.location.href = '/dashboard';
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
            <p>Loading dashboard...</p>
        </div>
    );
};

export default connect<any, IStoreProps, {}>(mapStateToProps, mapDispatchToProps)(SSOLandingComponent as any);
