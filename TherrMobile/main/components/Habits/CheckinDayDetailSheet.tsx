import React from 'react';
import {
    ActivityIndicator, Image, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Dialog, Divider, Portal } from 'react-native-paper';
import { ScrollView } from 'react-native-gesture-handler';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { IHabitCheckin } from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';
import ModalButton from '../Modals/ModalButton';
import { formatDayTitle, getStatusLabelKey, isDayInFuture } from '../../routes/Habits/checkinDayDetail';

export interface IResolvedProof {
    id: string;
    uri: string;
    mediaType: string;
}

/**
 * What happened on one calendar day, opened by tapping that day in
 * `HabitCalendar`.
 *
 * Read-only on purpose. Check-in notes and photos were write-only until this
 * screen existed — `habits.proofs` rows were written on every proof upload and
 * never read back by anything — so the first job is simply showing the user
 * what they already recorded. Editing a past day is a separate decision: the
 * check-in upsert would re-run streak accounting for a date whose streak
 * consequences have already been paid out.
 */
interface ICheckinDayDetailSheetProps {
    isVisible: boolean;
    /** The day tapped. Null while the sheet is closed. */
    date: Date | null;
    /** The check-in on that day, if there is one. */
    checkin?: IHabitCheckin;
    proofs: IResolvedProof[];
    /**
     * True while the proofs request (and the media-url resolution behind it) is
     * in flight. Distinct from `proofs.length === 0`: a check-in with
     * `hasProof` and no resolved images yet is loading, not empty.
     */
    isLoadingProofs: boolean;
    /** Set when the proofs request failed, so the sheet can say so. */
    hasProofError: boolean;
    onClose: () => void;
    onRetryProofs: () => void;
    translate: (key: string, params?: any) => string;
    themeConfirmModal: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeButtons: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const RATING_MAX = 5;

const RatingRow: React.FC<{
    label: string;
    value: number;
    color: string;
    mutedColor: string;
}> = ({
    label, value, color, mutedColor,
}) => (
    <View style={localStyles.ratingRow}>
        <Text style={[localStyles.ratingLabel, { color: mutedColor }]}>{label}</Text>
        <View style={localStyles.ratingDots}>
            {Array.from({ length: RATING_MAX }).map((_unused, index) => (
                <MaterialIcon
                    // The dots are a fixed-length scale, so the index IS the
                    // identity of each one — there is no reorder for a key to
                    // survive.
                    // eslint-disable-next-line react/no-array-index-key
                    key={`rating-dot-${index}`}
                    name={index < value ? 'star' : 'star-border'}
                    size={16}
                    color={index < value ? color : mutedColor}
                />
            ))}
        </View>
    </View>
);

const CheckinDayDetailSheet: React.FC<ICheckinDayDetailSheetProps> = ({
    isVisible,
    date,
    checkin,
    proofs,
    isLoadingProofs,
    hasProofError,
    onClose,
    onRetryProofs,
    translate,
    themeConfirmModal,
    themeButtons,
}) => {
    if (!date) {
        return null;
    }

    const statusLabelKey = getStatusLabelKey(checkin);
    const isFuture = isDayInFuture(date, new Date());
    const notes = checkin?.notes?.trim();

    const renderProofs = () => {
        if (!checkin?.hasProof) {
            return null;
        }

        if (hasProofError) {
            return (
                <Pressable onPress={onRetryProofs} style={localStyles.proofStateContainer}>
                    <Text style={[localStyles.proofStateText, { color: themeConfirmModal.colors.textGray }]}>
                        {translate('pages.habits.dayDetail.proofsFailed')}
                    </Text>
                    <Text style={[localStyles.proofRetryText, { color: themeConfirmModal.colors.brand }]}>
                        {translate('pages.habits.dayDetail.retry')}
                    </Text>
                </Pressable>
            );
        }

        // `hasProof` is set by the write path, so it is the honest signal that
        // images are coming. Trusting `proofs.length` instead would flash the
        // empty state on every open before the request lands.
        if (isLoadingProofs && !proofs.length) {
            return (
                <View style={localStyles.proofStateContainer}>
                    <ActivityIndicator color={themeConfirmModal.colors.brand} />
                </View>
            );
        }

        if (!proofs.length) {
            return (
                <View style={localStyles.proofStateContainer}>
                    <Text style={[localStyles.proofStateText, { color: themeConfirmModal.colors.textGray }]}>
                        {translate('pages.habits.dayDetail.proofsUnavailable')}
                    </Text>
                </View>
            );
        }

        return (
            <View style={localStyles.proofGrid}>
                {proofs.map((proof) => (
                    <View key={proof.id} style={localStyles.proofTile}>
                        <Image
                            source={{ uri: proof.uri }}
                            style={localStyles.proofImage}
                            accessibilityLabel={translate('pages.habits.dayDetail.proofImageAlt')}
                        />
                        {proof.mediaType === 'video' && (
                            <View style={localStyles.videoBadge}>
                                <MaterialIcon name="play-arrow" size={18} color="#fff" />
                            </View>
                        )}
                    </View>
                ))}
            </View>
        );
    };

    const renderBody = () => {
        if (!checkin) {
            return (
                <Text style={[themeConfirmModal.styles.bodyText, localStyles.emptyText]}>
                    {translate(isFuture
                        ? 'pages.habits.dayDetail.emptyFuture'
                        : 'pages.habits.dayDetail.emptyPast')}
                </Text>
            );
        }

        return (
            <>
                {statusLabelKey && (
                    <Text style={themeConfirmModal.styles.bodyTextBold}>
                        {translate(statusLabelKey)}
                    </Text>
                )}

                <Text style={[
                    themeConfirmModal.styles.bodyText,
                    localStyles.notes,
                    !notes && { color: themeConfirmModal.colors.textGray, fontStyle: 'italic' },
                ]}>
                    {notes || translate('pages.habits.dayDetail.noNote')}
                </Text>

                {!!checkin.selfRating && (
                    <RatingRow
                        label={translate('pages.habits.dayDetail.selfRating')}
                        value={checkin.selfRating}
                        color={themeConfirmModal.colors.brand}
                        mutedColor={themeConfirmModal.colors.textGray}
                    />
                )}
                {!!checkin.difficultyRating && (
                    <RatingRow
                        label={translate('pages.habits.dayDetail.difficultyRating')}
                        value={checkin.difficultyRating}
                        color={themeConfirmModal.colors.brand}
                        mutedColor={themeConfirmModal.colors.textGray}
                    />
                )}

                {renderProofs()}
            </>
        );
    };

    return (
        <Portal>
            <Dialog
                visible={isVisible}
                onDismiss={onClose}
                style={themeConfirmModal.styles.container}
            >
                <Dialog.Title style={themeConfirmModal.styles.headerText}>
                    {formatDayTitle(date, translate)}
                </Dialog.Title>
                <Divider />
                <Dialog.ScrollArea style={[themeConfirmModal.styles.body, localStyles.transparentBorder]}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                        {checkin?.habitGoalName ? (
                            <Text style={[localStyles.habitName, { color: themeConfirmModal.colors.textGray }]}>
                                {checkin.habitGoalEmoji ? `${checkin.habitGoalEmoji} ` : ''}
                                {checkin.habitGoalName}
                            </Text>
                        ) : null}
                        {renderBody()}
                    </ScrollView>
                </Dialog.ScrollArea>
                <Divider />
                <Dialog.Actions style={themeConfirmModal.styles.buttonsContainer}>
                    <ModalButton
                        iconName="close"
                        title={translate('pages.habits.dayDetail.close')}
                        onPress={onClose}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

const localStyles = StyleSheet.create({
    transparentBorder: {
        borderColor: 'transparent',
    },
    habitName: {
        fontSize: 13,
        paddingBottom: 6,
    },
    emptyText: {
        paddingVertical: 12,
    },
    notes: {
        paddingTop: 6,
        paddingBottom: 4,
        lineHeight: 20,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
    },
    ratingLabel: {
        fontSize: 13,
    },
    ratingDots: {
        flexDirection: 'row',
        gap: 2,
    },
    proofStateContainer: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    proofStateText: {
        fontSize: 13,
        textAlign: 'center',
    },
    proofRetryText: {
        fontSize: 13,
        fontWeight: '600',
        paddingTop: 6,
    },
    proofGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingTop: 12,
    },
    proofTile: {
        position: 'relative',
        width: '48%',
        aspectRatio: 1,
        borderRadius: 8,
        overflow: 'hidden',
    },
    proofImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    videoBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default CheckinDayDetailSheet;
