import React, { useCallback, useEffect, useState } from 'react';
import {
    Button,
    Group,
    Modal,
    Stack,
    Text,
    Textarea,
} from '@mantine/core';
import useTranslation from '../hooks/useTranslation';

const MAX_MESSAGE_LENGTH = 255;

interface IRepostModalProps {
    /** The thought being reposted. Null closes the modal. */
    thought: any;
    isSubmitting?: boolean;
    error?: string;
    onClose: () => void;
    /**
     * Receives the (trimmed) quote text. An empty string is a plain repost — the caller sends
     * it as the new thought's message either way, so this never has to distinguish the two.
     */
    onConfirm: (message: string) => void;
}

/**
 * Composer for a repost. The quote is optional by design: the fast path (open, confirm) is a
 * plain repost, and typing turns the same action into a quote repost without a second control.
 * Mirrors `RepostModal` in `TherrMobile/main/components/Modals/RepostModal.tsx`.
 */
const RepostModal: React.FC<IRepostModalProps> = ({
    thought, isSubmitting, error, onClose, onConfirm,
}) => {
    const { t: translate } = useTranslation();
    const [message, setMessage] = useState('');

    // Reset on open, not on close: the modal unmounts its body between openings but the state
    // outlives it, so without this the previous quote is pre-filled for the next thought.
    useEffect(() => {
        if (thought) {
            setMessage('');
        }
    }, [thought]);

    const handleConfirm = useCallback(() => {
        onConfirm(message.trim());
    }, [message, onConfirm]);

    return (
        <Modal
            opened={!!thought}
            onClose={onClose}
            title={translate('pages.exploreThoughts.repostModalTitle')}
            centered
            closeOnClickOutside={!isSubmitting}
            closeOnEscape={!isSubmitting}
        >
            <Stack gap="sm">
                <Textarea
                    placeholder={translate('pages.exploreThoughts.repostPlaceholder')}
                    value={message}
                    onChange={(e) => setMessage(e.currentTarget.value)}
                    minRows={2}
                    maxRows={5}
                    maxLength={MAX_MESSAGE_LENGTH}
                    disabled={isSubmitting}
                    autosize
                />

                <div className="thought-card-repost-embed">
                    <Text fw={600} size="xs" mb={4}>
                        {thought?.fromUserName || ''}
                    </Text>
                    <Text size="sm" className="thought-card-repost-embed-message">
                        {thought?.message || ''}
                    </Text>
                </div>

                {error && (
                    <Text size="xs" c="red">{error}</Text>
                )}

                <Group justify="space-between" align="center">
                    <Text size="xs" c="dimmed">{message.length}/{MAX_MESSAGE_LENGTH}</Text>
                    <Group gap="xs">
                        <Button variant="default" size="xs" onClick={onClose} disabled={isSubmitting}>
                            {translate('pages.exploreThoughts.repostCancel')}
                        </Button>
                        <Button size="xs" onClick={handleConfirm} loading={isSubmitting}>
                            {translate('pages.exploreThoughts.repostConfirm')}
                        </Button>
                    </Group>
                </Group>
            </Stack>
        </Modal>
    );
};

export default RepostModal;
