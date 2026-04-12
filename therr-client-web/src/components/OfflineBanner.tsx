import * as React from 'react';
import { useSelector } from 'react-redux';

const bannerStyle: React.CSSProperties = {
    backgroundColor: '#F59E0B',
    color: '#1A1A1A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 600,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10000,
};

const dismissStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#1A1A1A',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    marginLeft: '8px',
    padding: '0 4px',
    lineHeight: 1,
};

const OfflineBanner: React.FC = () => {
    const isConnected = useSelector((state: any) => state.network?.isConnected);
    const [dismissed, setDismissed] = React.useState(false);

    React.useEffect(() => {
        if (isConnected) {
            setDismissed(false);
        }
    }, [isConnected]);

    if (isConnected !== false || dismissed) {
        return null;
    }

    return (
        <div style={bannerStyle} role="alert">
            <span>You are offline. Showing cached data.</span>
            <button
                type="button"
                style={dismissStyle}
                onClick={() => setDismissed(true)}
                aria-label="Dismiss offline notification"
            >
                &times;
            </button>
        </div>
    );
};

export default OfflineBanner;
