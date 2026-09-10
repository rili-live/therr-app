import * as React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Alert, Button, Group } from '@mantine/core';
import useTranslation from '../hooks/useTranslation';

const DISMISS_STORAGE_KEY = 'incompleteProfileBannerDismissedAt';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const isDismissed = (): boolean => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return false;
    }
    try {
        const dismissedAt = window.localStorage.getItem(DISMISS_STORAGE_KEY);
        if (!dismissedAt) {
            return false;
        }
        const dismissedTime = parseInt(dismissedAt, 10);
        if (Number.isNaN(dismissedTime)) {
            return false;
        }
        return Date.now() - dismissedTime < DISMISS_DURATION_MS;
    } catch {
        return false;
    }
};

/**
 * IncompleteProfileBanner
 *
 * Nudges logged-in users who skipped entering a first name during the now-optional
 * onboarding flow to add it later. Renders only when `user.details.firstName` is falsy.
 * Dismissal is persisted to localStorage with a timestamp and re-shows after 7 days.
 */
const IncompleteProfileBanner: React.FC = () => {
    const { t: translate } = useTranslation();
    const user = useSelector((state: any) => state.user);
    const [dismissed, setDismissed] = React.useState<boolean>(() => isDismissed());

    const hasFirstName = !!user?.details?.firstName;
    const isAuthenticated = !!user?.details?.id;

    const handleDismiss = React.useCallback(() => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(DISMISS_STORAGE_KEY, `${Date.now()}`);
            }
        } catch {
            // Ignore storage errors (e.g. private browsing); just hide for this session.
        }
        setDismissed(true);
    }, []);

    if (!isAuthenticated || hasFirstName || dismissed) {
        return null;
    }

    return (
        <Alert
            id="incomplete_profile_banner"
            color="blue"
            variant="light"
            radius="md"
            withCloseButton
            closeButtonLabel={translate('components.incompleteProfileBanner.dismiss')}
            onClose={handleDismiss}
            title={translate('components.incompleteProfileBanner.title')}
        >
            <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                <span>{translate('components.incompleteProfileBanner.message')}</span>
                <Button
                    component={Link}
                    to="/user/edit-profile"
                    size="xs"
                    variant="filled"
                >
                    {translate('components.incompleteProfileBanner.addName')}
                </Button>
            </Group>
        </Alert>
    );
};

export default IncompleteProfileBanner;
