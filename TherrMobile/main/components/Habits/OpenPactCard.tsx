import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Switch } from 'react-native-paper';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { IPactJoinRequest } from 'therr-react/types';
import { Button } from '../BaseButton';

interface IOpenPactCardProps {
    isOpen: boolean;
    /** Whether the switch is offered at all — a pending or running pact the viewer created. */
    canToggle: boolean;
    isSaving: boolean;
    onToggle: (isOpen: boolean) => void;
    /** Pending requests to answer. Rendered whenever there are any, even after closing. */
    joinRequests: IPactJoinRequest[];
    answeringRequestId: string | null;
    onApprove: (request: IPactJoinRequest) => void;
    onDecline: (request: IPactJoinRequest) => void;
    /** Offered only while nobody has accepted: "your invite went unanswered, look elsewhere". */
    onFindOpenPacts?: () => void;
    translate: (key: string, params?: any) => string;
    themeHabits: any;
    themeButtons: any;
}

/**
 * The creator's corner of open pacts on the pact screen: one switch, the requests waiting on an
 * answer, and — while the invite is unanswered — a way to look for someone else's open pact on the
 * same habit. Everything here is optional and stays out of the way: closed by default, one line of
 * explanation, and no card at all once there is nothing to show.
 */
const OpenPactCard = ({
    isOpen,
    canToggle,
    isSaving,
    onToggle,
    joinRequests,
    answeringRequestId,
    onApprove,
    onDecline,
    onFindOpenPacts,
    translate,
    themeHabits,
    themeButtons,
}: IOpenPactCardProps) => {
    if (!canToggle && !joinRequests.length && !onFindOpenPacts) {
        return null;
    }

    return (
        <View style={themeHabits.styles.streakWidgetContainer}>
            {canToggle && (
                <View style={themeHabits.styles.habitNotificationPrefsRow}>
                    <View style={themeHabits.styles.habitNotificationPrefsLabelContainer}>
                        <Text style={themeHabits.styles.habitNotificationPrefsLabel}>
                            {translate('pages.pacts.openPact.toggleLabel')}
                        </Text>
                        <Text style={themeHabits.styles.habitNotificationPrefsHint}>
                            {translate('pages.pacts.openPact.toggleHint')}
                        </Text>
                    </View>
                    {isSaving ? (
                        <ActivityIndicator
                            color={themeHabits.colors.primary3}
                            style={themeHabits.styles.habitNotificationPrefsSpinner}
                        />
                    ) : (
                        <Switch
                            accessibilityLabel={translate('pages.pacts.openPact.toggleLabel')}
                            color={themeHabits.colors.primary3}
                            value={isOpen}
                            onValueChange={() => onToggle(!isOpen)}
                        />
                    )}
                </View>
            )}

            {joinRequests.length > 0 && (
                <View style={{ marginTop: canToggle ? 12 : 0 }}>
                    <Text style={themeHabits.styles.streakWidgetTitle}>
                        {translate('pages.pacts.openPact.requestsTitle', { count: joinRequests.length })}
                    </Text>
                    {joinRequests.map((request, index) => {
                        const name = request.requesterUserName || translate('pages.pacts.partnerFallback');
                        const isAnswering = answeringRequestId === request.id;

                        return (
                            <View
                                key={request.id}
                                style={[
                                    themeHabits.styles.habitNotificationPrefsRow,
                                    index > 0 && themeHabits.styles.pactMemberRowDivided,
                                ]}
                            >
                                <View style={themeHabits.styles.habitNotificationPrefsLabelContainer}>
                                    <Text style={themeHabits.styles.habitNotificationPrefsLabel}>
                                        {name}
                                    </Text>
                                    <Text style={themeHabits.styles.habitNotificationPrefsHint}>
                                        {translate('pages.pacts.openPact.requestHint')}
                                    </Text>
                                </View>
                                {isAnswering ? (
                                    <ActivityIndicator color={themeHabits.colors.primary3} />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Button
                                            buttonStyle={themeButtons.styles.btnClear}
                                            titleStyle={themeButtons.styles.btnTitleBlack}
                                            title={translate('pages.pacts.openPact.decline')}
                                            accessibilityLabel={translate('pages.pacts.openPact.declineFor', { name })}
                                            onPress={() => onDecline(request)}
                                            disabled={!!answeringRequestId}
                                        />
                                        <Button
                                            buttonStyle={themeButtons.styles.btnClear}
                                            titleStyle={themeButtons.styles.btnTitleBlack}
                                            title={translate('pages.pacts.openPact.approve')}
                                            accessibilityLabel={translate('pages.pacts.openPact.approveFor', { name })}
                                            onPress={() => onApprove(request)}
                                            disabled={!!answeringRequestId}
                                        />
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            )}

            {onFindOpenPacts && (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={translate('pages.pacts.openPact.findCta')}
                    onPress={onFindOpenPacts}
                    style={({ pressed }) => [
                        themeHabits.styles.pactLinkRow,
                        !canToggle && !joinRequests.length && { marginTop: 0, paddingTop: 0, borderTopWidth: 0 },
                        pressed && themeHabits.styles.pactPressedSurface,
                    ]}
                >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={themeHabits.styles.pactLinkText}>
                            {translate('pages.pacts.openPact.findCta')}
                        </Text>
                        <Text style={themeHabits.styles.habitNotificationPrefsHint}>
                            {translate('pages.pacts.openPact.findHint')}
                        </Text>
                    </View>
                    <MaterialIcon
                        name="chevron-right"
                        size={24}
                        color={themeHabits.colors.primary3}
                    />
                </Pressable>
            )}
        </View>
    );
};

export default OpenPactCard;
