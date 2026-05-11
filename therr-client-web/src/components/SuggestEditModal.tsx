import * as React from 'react';
import {
    Modal, Stack, Select, TextInput, Group, Button, Alert, Text,
} from '@mantine/core';
import { MapsService } from 'therr-react/services';
// eslint-disable-next-line import/no-unresolved, import/extensions
import normalizeCorrectionValue from 'therr-js-utilities/normalize-correction-value';
import getOrCreateAnonSessionId from '../utilities/anonSessionId';

type FieldName = 'phoneNumber' | 'websiteUrl';

interface ISuggestEditModalProps {
    opened: boolean;
    onClose: () => void;
    spaceId: string;
    initialField?: FieldName;
    translate: (key: string, params?: any) => string;
}

interface ISubmissionResult {
    status: 'pending' | 'applied';
    agreementCount: number;
    threshold: number;
    isOwnerClaimed: boolean;
}

const SuggestEditModal: React.FC<ISuggestEditModalProps> = ({
    opened, onClose, spaceId, initialField, translate,
}) => {
    const [fieldName, setFieldName] = React.useState<FieldName>(initialField || 'phoneNumber');
    const [value, setValue] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [result, setResult] = React.useState<ISubmissionResult | null>(null);
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        if (opened) {
            setFieldName(initialField || 'phoneNumber');
            setValue('');
            setResult(null);
            setError('');
        }
    }, [opened, initialField]);

    const normalized = React.useMemo(() => {
        if (!value.trim()) return null;
        return normalizeCorrectionValue(fieldName, value);
    }, [fieldName, value]);

    const previewText = (() => {
        if (!normalized) return '';
        if (normalized.ok) return normalized.canonical as string;
        // TS doesn't reliably narrow generic discriminated unions through the
        // .ok flag here, so reach for the field explicitly via the failure type.
        const errorCode = (normalized as { error: string }).error;
        return translate(`pages.viewSpace.suggestEdit.errors.${errorCode}`)
            || translate('pages.viewSpace.suggestEdit.invalidValue');
    })();

    const canSubmit = !!normalized && normalized.ok && !isSubmitting;

    // Server returns codes like 'INVALID_VALUE:INVALID_PHONE' from the normalizer
    // or bare codes like 'MISSING_ANON_IDENTITY' for infrastructure failures.
    // The translator returns the key string when a lookup misses, so we detect
    // that and fall back to the generic errorMessage rather than showing the raw
    // code to the user.
    const translateServerError = (raw: unknown): string => {
        const fallback = translate('pages.viewSpace.suggestEdit.errorMessage');
        if (typeof raw !== 'string' || !raw) return fallback;
        const parts = raw.split(':');
        const code = parts[0] === 'INVALID_VALUE' && parts[1] ? parts[1] : parts[0];
        const lookupKey = `pages.viewSpace.suggestEdit.errors.${code}`;
        const specific = translate(lookupKey);
        return specific !== lookupKey ? specific : fallback;
    };

    const handleSubmit = async () => {
        if (!normalized || !normalized.ok) return;
        setIsSubmitting(true);
        setError('');
        try {
            const anonSessionId = getOrCreateAnonSessionId();
            const response = await MapsService.submitSpaceCorrection(
                spaceId,
                { fieldName, value: normalized.canonical },
                anonSessionId ? { 'x-anon-session-id': anonSessionId } : undefined,
            );
            setResult(response.data as ISubmissionResult);
        } catch (err: any) {
            setError(translateServerError(err?.response?.data?.message));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={translate('pages.viewSpace.suggestEdit.title')}
            centered
        >
            <Stack gap="md">
                {result ? (
                    <Alert color={result.status === 'applied' ? 'green' : 'blue'} radius="md">
                        {result.status === 'applied' && (
                            <Text fw={500}>{translate('pages.viewSpace.suggestEdit.appliedMessage')}</Text>
                        )}
                        {result.status === 'pending' && result.isOwnerClaimed && (
                            <Text fw={500}>{translate('pages.viewSpace.suggestEdit.ownerClaimedMessage')}</Text>
                        )}
                        {result.status === 'pending' && !result.isOwnerClaimed && (
                            <Text fw={500}>
                                {translate('pages.viewSpace.suggestEdit.pendingMessage', {
                                    remaining: Math.max(0, result.threshold - result.agreementCount),
                                })}
                            </Text>
                        )}
                        <Group justify="flex-end" mt="sm">
                            <Button variant="subtle" onClick={onClose} size="xs">
                                {translate('pages.viewSpace.suggestEdit.close')}
                            </Button>
                        </Group>
                    </Alert>
                ) : (
                    <>
                        <Text size="sm" c="dimmed">
                            {translate('pages.viewSpace.suggestEdit.description')}
                        </Text>
                        <Select
                            label={translate('pages.viewSpace.suggestEdit.fieldLabel')}
                            value={fieldName}
                            onChange={(v) => v && setFieldName(v as FieldName)}
                            data={[
                                { value: 'phoneNumber', label: translate('pages.viewSpace.suggestEdit.phoneOption') },
                                { value: 'websiteUrl', label: translate('pages.viewSpace.suggestEdit.websiteOption') },
                            ]}
                            disabled={isSubmitting}
                        />
                        <TextInput
                            label={translate('pages.viewSpace.suggestEdit.valueLabel')}
                            value={value}
                            onChange={(e) => setValue(e.currentTarget.value)}
                            placeholder={fieldName === 'phoneNumber'
                                ? translate('pages.viewSpace.suggestEdit.phonePlaceholder')
                                : translate('pages.viewSpace.suggestEdit.websitePlaceholder')}
                            disabled={isSubmitting}
                            autoFocus
                        />
                        {previewText && (
                            <Text size="xs" c={normalized?.ok ? 'dimmed' : 'red'}>
                                {normalized?.ok
                                    ? `${translate('pages.viewSpace.suggestEdit.normalizedPreview')}: ${previewText}`
                                    : previewText}
                            </Text>
                        )}
                        {error && (
                            <Alert color="red" radius="md">{error}</Alert>
                        )}
                        <Group justify="flex-end">
                            <Button variant="subtle" onClick={onClose} disabled={isSubmitting}>
                                {translate('pages.viewSpace.suggestEdit.cancel')}
                            </Button>
                            <Button onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting}>
                                {translate('pages.viewSpace.suggestEdit.submit')}
                            </Button>
                        </Group>
                    </>
                )}
            </Stack>
        </Modal>
    );
};

export default SuggestEditModal;
