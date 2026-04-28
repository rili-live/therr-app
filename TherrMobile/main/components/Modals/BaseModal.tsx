import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Dialog, Divider, Portal } from 'react-native-paper';
import { ScrollView } from 'react-native-gesture-handler';
import { useSelector } from 'react-redux';
import { getTheme } from '../../styles/themes';
import { shadowLg } from '../../styles/elevation';
import { fontSizes, fontWeights } from '../../styles/text';
import { radius } from '../../styles/radii';
import { space } from '../../styles/layouts/spacing';
import { therrFontFamily } from '../../styles/font';

interface IBaseModalProps {
    isVisible: boolean;
    onDismiss?: () => void;
    /**
     * Optional header text. When set, renders a Dialog.Title above a divider.
     * When omitted, the body renders without a title row.
     */
    headerText?: string;
    /**
     * Body content. Wrapped in a ScrollView so long content paginates inside
     * the dialog instead of overflowing.
     */
    children: React.ReactNode;
    /**
     * Optional footer rendered inside `Dialog.Actions` below a divider —
     * typically one or two `<ModalButton>` instances. Omit for info-only
     * dialogs that close via the backdrop.
     */
    actions?: React.ReactNode;
    /** Width override. Accepts a percentage string or a fixed pixel number. */
    width?: string | number;
    /** Whether tapping the backdrop dismisses the modal. Defaults to true. */
    dismissable?: boolean;
}

// Shared modal shell: backdrop, container shadow, padding, header typography.
// Today's modal styles (`styles/modal/index.ts`) keep working for
// non-migrated modals — BaseModal is opt-in. ConfirmModal and InfoModal are
// the proof-of-adoption call sites.
const BaseModal = ({
    isVisible,
    onDismiss,
    headerText,
    children,
    actions,
    width,
    dismissable = true,
}: IBaseModalProps) => {
    const themeName = useSelector((state: any) => state?.user?.settings?.mobileThemeName);
    const therrTheme = getTheme(themeName);

    const containerStyle: ViewStyle = {
        // Phase 2 semantic aliases — `surfaceAlt` reads as a soft inset surface,
        // `onSurface` is the matching text color for both light and dark.
        backgroundColor: therrTheme.colors.surfaceAlt,
        borderRadius: radius.lg,
        ...shadowLg,
        ...(width != null ? { width: typeof width === 'number' ? width : (width as any) } : {}),
    };

    return (
        <Portal>
            <Dialog
                visible={isVisible}
                onDismiss={onDismiss}
                dismissable={dismissable}
                style={[localStyles.container, containerStyle]}
            >
                {headerText ? (
                    <>
                        <Dialog.Title style={[localStyles.headerText, { color: therrTheme.colors.onSurface }]}>
                            {headerText}
                        </Dialog.Title>
                        <Divider />
                    </>
                ) : null}
                <Dialog.ScrollArea style={[localStyles.body, localStyles.transparentBorder]}>
                    <ScrollView>
                        {children}
                    </ScrollView>
                </Dialog.ScrollArea>
                {actions ? (
                    <>
                        <Divider />
                        <Dialog.Actions style={localStyles.actionsContainer}>
                            <View style={localStyles.actionsRow}>
                                {actions}
                            </View>
                        </Dialog.Actions>
                    </>
                ) : null}
            </Dialog>
        </Portal>
    );
};

const localStyles = StyleSheet.create({
    container: {
        // Constrain height so very long bodies don't push actions off-screen.
        maxHeight: '80%',
        // Default width used when caller doesn't pass `width`.
        width: '85%',
        alignSelf: 'center',
    },
    headerText: {
        fontFamily: therrFontFamily,
        fontSize: fontSizes.xl,
        fontWeight: fontWeights.semibold,
        textAlign: 'center',
        paddingTop: space.md,
        paddingBottom: space.sm,
    },
    body: {
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
    },
    transparentBorder: {
        borderColor: 'transparent',
    },
    actionsContainer: {
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
    },
    actionsRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
});

export default BaseModal;
