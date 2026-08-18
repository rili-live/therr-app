import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { MapsService } from 'therr-react/services';
import { getTheme, ITherrThemeColors } from '../../styles/themes';
import { fontSizes, fontWeights } from '../../styles/text';
import { therrFontFamily } from '../../styles/font';
import { space } from '../../styles/layouts/spacing';
import BaseInput from '../Input';
import BaseModal from './BaseModal';
import ModalButton from './ModalButton';
import getOrCreateAnonSessionId from '../../utilities/anonSessionId';
import normalizeCorrectionValue, { CorrectionFieldName } from '../../utilities/correctionValue';

interface ISubmissionResult {
    status: 'pending' | 'applied';
    agreementCount: number;
    threshold: number;
    isOwnerClaimed: boolean;
}

interface ISuggestEditModalProps {
    isVisible: boolean;
    onRequestClose: () => void;
    spaceId: string;
    /** Pre-selects a field when the modal is opened from a specific value. */
    initialField?: CorrectionFieldName;
    /**
     * Called when a submission reached the agreement threshold and was written
     * to the space immediately. The screen is showing the pre-correction value
     * at that point, so callers should refetch.
     */
    onApplied?: () => void;
    translate: Function;
    themeButtons: {
        colors?: ITherrThemeColors;
        styles: any;
    };
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const TRANSLATION_PREFIX = 'pages.viewSpace.suggestEdit';

/**
 * Crowdsourced correction workflow for space contact details, mirroring
 * `SuggestEditModal` in therr-client-web. Submissions are bucketed by
 * normalized value server-side and applied once enough people agree.
 *
 * Anonymous users are supported: the gateway needs an `x-anon-session-id`
 * header to derive a submitter identity when there is no auth token.
 */
const SuggestEditModal = ({
    isVisible,
    onRequestClose,
    spaceId,
    initialField,
    onApplied,
    translate,
    themeButtons,
    themeForms,
}: ISuggestEditModalProps) => {
    const themeName = useSelector((state: any) => state?.user?.settings?.mobileThemeName);
    const therrTheme = getTheme(themeName);

    const [fieldName, setFieldName] = useState<CorrectionFieldName>(initialField || 'phoneNumber');
    const [value, setValue] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<ISubmissionResult | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isVisible) {
            setFieldName(initialField || 'phoneNumber');
            setValue('');
            setResult(null);
            setError('');
        }
    }, [isVisible, initialField]);

    const normalized = useMemo(
        () => (value.trim() ? normalizeCorrectionValue(fieldName, value) : null),
        [fieldName, value],
    );

    const canSubmit = !!normalized && normalized.ok && !isSubmitting;

    /**
     * The server returns codes like `INVALID_VALUE:INVALID_PHONE` from the
     * normalizer, or bare codes like `MISSING_ANON_IDENTITY` for infrastructure
     * failures. `translator` echoes the key back when a lookup misses, so we
     * detect that and fall back to the generic message rather than showing a
     * raw code.
     */
    const translateErrorCode = useCallback((raw: unknown): string => {
        const fallback = translate(`${TRANSLATION_PREFIX}.errorMessage`);
        if (typeof raw !== 'string' || !raw) {
            return fallback;
        }
        const parts = raw.split(':');
        const code = parts[0] === 'INVALID_VALUE' && parts[1] ? parts[1] : parts[0];
        const lookupKey = `${TRANSLATION_PREFIX}.errors.${code}`;
        const specific = translate(lookupKey);
        return specific && specific !== lookupKey ? specific : fallback;
    }, [translate]);

    const previewText = useMemo(() => {
        if (!normalized) {
            return '';
        }
        if (normalized.ok) {
            return `${translate(`${TRANSLATION_PREFIX}.normalizedPreview`)}: ${normalized.canonical}`;
        }
        return translateErrorCode(normalized.error);
    }, [normalized, translate, translateErrorCode]);

    const handleSubmit = useCallback(() => {
        if (!normalized || !normalized.ok) {
            return;
        }
        setIsSubmitting(true);
        setError('');

        getOrCreateAnonSessionId()
            .then((anonSessionId) => MapsService.submitSpaceCorrection(
                spaceId,
                { fieldName, value: normalized.canonical },
                anonSessionId ? { 'x-anon-session-id': anonSessionId } : undefined,
            ))
            .then((response) => {
                const submission = response?.data as ISubmissionResult;
                setResult(submission);
                if (submission?.status === 'applied') {
                    onApplied?.();
                }
            })
            .catch((err: any) => {
                // Rate-limit responses carry a prose message rather than a code,
                // so they'd otherwise fall through to the generic "try again".
                if (err?.response?.status === 429) {
                    setError(translate(`${TRANSLATION_PREFIX}.rateLimited`));
                    return;
                }
                setError(translateErrorCode(err?.response?.data?.message));
            })
            .finally(() => {
                setIsSubmitting(false);
            });
    }, [normalized, spaceId, fieldName, onApplied, translate, translateErrorCode]);

    const renderResult = (submission: ISubmissionResult) => {
        if (submission.status === 'applied') {
            return translate(`${TRANSLATION_PREFIX}.appliedMessage`);
        }
        if (submission.isOwnerClaimed) {
            return translate(`${TRANSLATION_PREFIX}.ownerClaimedMessage`);
        }
        return translate(`${TRANSLATION_PREFIX}.pendingMessage`, {
            remaining: Math.max(0, (submission.threshold || 0) - (submission.agreementCount || 0)),
        });
    };

    return (
        <BaseModal
            isVisible={isVisible}
            onDismiss={onRequestClose}
            headerText={translate(`${TRANSLATION_PREFIX}.title`)}
            dismissable={!isSubmitting}
            actions={result ? (
                <ModalButton
                    iconName="check"
                    title={translate(`${TRANSLATION_PREFIX}.close`)}
                    onPress={onRequestClose}
                    iconRight={false}
                    themeButtons={themeButtons}
                />
            ) : (
                <>
                    <ModalButton
                        iconName="close"
                        title={translate(`${TRANSLATION_PREFIX}.cancel`)}
                        onPress={onRequestClose}
                        disabled={isSubmitting}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                    <ModalButton
                        iconName="send"
                        title={translate(`${TRANSLATION_PREFIX}.submit`)}
                        onPress={handleSubmit}
                        disabled={!canSubmit}
                        loading={isSubmitting}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                </>
            )}
        >
            {result ? (
                <Text style={[localStyles.bodyText, { color: therrTheme.colors.onSurface }]}>
                    {renderResult(result)}
                </Text>
            ) : (
                <View>
                    <Text style={[localStyles.bodyText, { color: therrTheme.colors.onSurfaceMuted }]}>
                        {translate(`${TRANSLATION_PREFIX}.description`)}
                    </Text>
                    <Text style={[localStyles.label, { color: therrTheme.colors.onSurface }]}>
                        {translate(`${TRANSLATION_PREFIX}.fieldLabel`)}
                    </Text>
                    <SegmentedButtons
                        value={fieldName}
                        onValueChange={(nextField) => setFieldName(nextField as CorrectionFieldName)}
                        buttons={[
                            {
                                value: 'phoneNumber',
                                label: translate(`${TRANSLATION_PREFIX}.phoneOption`),
                                icon: 'phone',
                                disabled: isSubmitting,
                                testID: 'suggest-edit-field-phoneNumber',
                            },
                            {
                                value: 'websiteUrl',
                                label: translate(`${TRANSLATION_PREFIX}.websiteOption`),
                                icon: 'web',
                                disabled: isSubmitting,
                                testID: 'suggest-edit-field-websiteUrl',
                            },
                        ]}
                    />
                    <BaseInput
                        variant="square"
                        containerStyle={localStyles.inputContainer}
                        label={translate(`${TRANSLATION_PREFIX}.valueLabel`)}
                        value={value}
                        onChangeText={setValue}
                        placeholder={fieldName === 'phoneNumber'
                            ? translate(`${TRANSLATION_PREFIX}.phonePlaceholder`)
                            : translate(`${TRANSLATION_PREFIX}.websitePlaceholder`)}
                        keyboardType={fieldName === 'phoneNumber' ? 'phone-pad' : 'url'}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isSubmitting}
                        themeForms={themeForms}
                        testID="suggest-edit-value-input"
                    />
                    {previewText ? (
                        <Text style={[
                            localStyles.previewText,
                            { color: normalized?.ok ? therrTheme.colors.onSurfaceMuted : therrTheme.colors.accentRed },
                        ]}>
                            {previewText}
                        </Text>
                    ) : null}
                    {error ? (
                        <Text style={[localStyles.previewText, { color: therrTheme.colors.accentRed }]}>
                            {error}
                        </Text>
                    ) : null}
                </View>
            )}
        </BaseModal>
    );
};

const localStyles = StyleSheet.create({
    bodyText: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.md,
        fontWeight: fontWeights.regular,
        textAlign: 'center',
        paddingVertical: space.xs,
    },
    label: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.semibold,
        paddingTop: space.md,
        paddingBottom: space.sm,
    },
    inputContainer: {
        marginTop: space.md,
    },
    previewText: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.regular,
        paddingTop: space.xs,
    },
});

export default SuggestEditModal;
