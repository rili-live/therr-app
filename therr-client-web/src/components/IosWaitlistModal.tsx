import React, { useCallback, useEffect, useState } from 'react';
import {
    Button,
    Modal,
    Stack,
    Text,
    TextInput,
} from '@mantine/core';
import ReactGA from 'react-ga4';
import { UsersService } from 'therr-react/services';
import useTranslation from '../hooks/useTranslation';

/** Deliberately loose — the gateway's isEmail() is the real rule; this only fails fast. */
const EMAIL_SHAPE = /^\S+@\S+\.\S+$/;

interface IIosWaitlistModalProps {
    opened: boolean;
    onClose: () => void;
    /**
     * Which CTA opened this, e.g. 'home_hero'. Sent as the GA4 `location` parameter so a
     * report can say which placement produced the demand rather than only how much there is.
     */
    location: string;
}

/**
 * Explains that there is no iOS build yet, and turns the disappointment into a measurable
 * signal: a GA4 event for the click and a row in main."emailMarketingSubscribers" for anyone
 * who leaves an address.
 *
 * The email is optional on purpose — the click alone is the demand number, and forcing a
 * signup to see the explanation would depress it. The sibling implementation for
 * habits.therr.com is inline in views/habits/landing.hbs, which ships no React bundle; keep
 * the two event names identical or the funnel cannot be compared across the two apps.
 */
const IosWaitlistModal: React.FC<IIosWaitlistModalProps> = ({ opened, onClose, location }) => {
    const { t: translate } = useTranslation();
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [isDone, setIsDone] = useState(false);

    // Reset on open rather than close: the body unmounts between openings but this state
    // outlives it, so a second visitor to the modal would otherwise see the first success.
    useEffect(() => {
        if (opened) {
            setEmail('');
            setError('');
            setIsDone(false);
            setIsSubmitting(false);
        }
    }, [opened]);

    const handleSubmit = useCallback((e?: React.FormEvent) => {
        e?.preventDefault();
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setError(translate('components.iosWaitlistModal.errorRequired'));
            return;
        }
        // The gateway rejects a malformed address with a generic validation message. Failing
        // fast here says something useful instead; the server rule is still the one that counts.
        if (!EMAIL_SHAPE.test(trimmedEmail)) {
            setError(translate('validations.email'));
            return;
        }

        setIsSubmitting(true);
        setError('');
        UsersService.subscribeToEmailList({
            email: trimmedEmail,
            isSubscribedToIosWaitlist: true,
        }).then(() => {
            setIsDone(true);
            // The conversion worth optimising toward. Mark it as a key event in GA4 admin,
            // alongside `ios_interest_click`, or it is collected but not reportable.
            //
            // Guarded, like `track()` in landing.hbs: the address is already saved by the
            // time this runs, and a blocker that stubs `window.gtag` with something that
            // throws must not turn that success into the generic error below.
            try {
                ReactGA.event('ios_waitlist_submit', {
                    app: 'therr',
                    location,
                });
            } catch {
                // no-op
            }
        }).catch((err) => {
            setError(err?.response?.data?.message || translate('components.iosWaitlistModal.errorGeneric'));
        }).then(() => setIsSubmitting(false));
    }, [email, location, translate]);

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={translate('components.iosWaitlistModal.title')}
            centered
            closeOnClickOutside={!isSubmitting}
            closeOnEscape={!isSubmitting}
        >
            <Stack gap="sm">
                <Text size="sm">{translate('components.iosWaitlistModal.body')}</Text>

                {isDone
                    ? <Text size="sm" fw={600}>{translate('components.iosWaitlistModal.success')}</Text>
                    : (
                        <form onSubmit={handleSubmit}>
                            <Stack gap="sm">
                                <Text size="sm">{translate('components.iosWaitlistModal.prompt')}</Text>
                                <TextInput
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.currentTarget.value)}
                                    placeholder={translate('components.iosWaitlistModal.emailPlaceholder')}
                                    aria-label={translate('components.iosWaitlistModal.emailPlaceholder')}
                                    disabled={isSubmitting}
                                    error={error || undefined}
                                />
                                <Button type="submit" loading={isSubmitting} fullWidth>
                                    {translate('components.iosWaitlistModal.submit')}
                                </Button>
                                <Text size="xs" c="dimmed">
                                    {translate('components.iosWaitlistModal.androidNote')}
                                </Text>
                            </Stack>
                        </form>
                    )}
            </Stack>
        </Modal>
    );
};

export default IosWaitlistModal;
