import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';
import { buttonMenuHeight } from '../navigation/buttonMenu';

/**
 * Drops (docs/DROPS.md): the inbox, the create form and the drop itself share one sheet, built
 * from the semantic theme aliases so every theme and brand override applies.
 */
const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);
    const { colors } = therrTheme;

    const styles = StyleSheet.create({
        body: {
            flex: 1,
            backgroundColor: colors.surfaceAlt,
        },
        scrollContent: {
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: buttonMenuHeight + 32,
        },
        tabsContainer: {
            flexDirection: 'row',
            paddingHorizontal: 14,
            paddingTop: 12,
            paddingBottom: 8,
        },
        tab: {
            flex: 1,
            paddingVertical: 8,
            marginHorizontal: 4,
            borderRadius: 20,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
        },
        tabActive: {
            backgroundColor: colors.brand,
            borderColor: colors.brand,
        },
        tabText: {
            fontWeight: '600',
            color: colors.onSurface,
        },
        tabTextActive: {
            color: colors.onBrand,
        },
        listContent: {
            paddingHorizontal: 16,
            paddingBottom: buttonMenuHeight + 32,
        },
        card: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
            marginBottom: 10,
        },
        cardIcon: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brandFaded,
            marginRight: 12,
        },
        cardBody: {
            flex: 1,
        },
        cardTitle: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.onSurface,
        },
        cardSubtitle: {
            fontSize: 13,
            color: colors.onSurfaceMuted,
            marginTop: 2,
        },
        statusPill: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
            backgroundColor: colors.surfaceAlt,
            marginLeft: 8,
        },
        statusPillOpened: {
            backgroundColor: colors.brand,
        },
        statusPillText: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.onSurfaceMuted,
        },
        statusPillTextOpened: {
            color: colors.onBrand,
        },
        emptyContainer: {
            alignItems: 'center',
            paddingHorizontal: 32,
            paddingTop: 48,
        },
        emptyTitle: {
            fontSize: 17,
            fontWeight: '600',
            color: colors.onSurface,
            textAlign: 'center',
            marginTop: 12,
        },
        emptyText: {
            fontSize: 14,
            color: colors.onSurfaceMuted,
            textAlign: 'center',
            marginTop: 6,
            lineHeight: 20,
        },
        sectionLabel: {
            fontSize: 13,
            fontWeight: '700',
            color: colors.onSurfaceMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginTop: 18,
            marginBottom: 8,
        },
        helperText: {
            fontSize: 13,
            color: colors.onSurfaceMuted,
            marginTop: 6,
            lineHeight: 18,
        },
        errorText: {
            fontSize: 13,
            color: '#C62828',
            marginTop: 6,
        },
        textInput: {
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 15,
            color: colors.onSurface,
        },
        textInputMultiline: {
            minHeight: 96,
            textAlignVertical: 'top',
        },
        chipsContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
        },
        chip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            marginRight: 8,
            marginBottom: 8,
        },
        chipSelected: {
            backgroundColor: colors.brand,
            borderColor: colors.brand,
        },
        chipText: {
            fontSize: 14,
            color: colors.onSurface,
        },
        chipTextSelected: {
            color: colors.onBrand,
            fontWeight: '600',
        },
        photoPicker: {
            height: 160,
            borderRadius: 14,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
        },
        photo: {
            width: '100%',
            height: '100%',
        },
        photoFull: {
            width: '100%',
            aspectRatio: 1,
            borderRadius: 14,
            marginTop: 12,
            backgroundColor: colors.surface,
        },
        locationRow: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
        },
        locationText: {
            flex: 1,
            marginLeft: 10,
            fontSize: 14,
            color: colors.onSurface,
        },
        submitContainer: {
            marginTop: 24,
        },
        hero: {
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: 24,
            paddingHorizontal: 20,
        },
        heroIcon: {
            width: 84,
            height: 84,
            borderRadius: 42,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brandFaded,
        },
        heroTitle: {
            fontSize: 19,
            fontWeight: '700',
            color: colors.onSurface,
            textAlign: 'center',
            marginTop: 14,
        },
        heroSubtitle: {
            fontSize: 14,
            color: colors.onSurfaceMuted,
            textAlign: 'center',
            marginTop: 6,
            lineHeight: 20,
        },
        distanceText: {
            fontSize: 28,
            fontWeight: '700',
            color: colors.brand,
            marginTop: 14,
        },
        messageText: {
            fontSize: 17,
            lineHeight: 24,
            color: colors.onSurface,
            marginTop: 16,
            alignSelf: 'stretch',
        },
        actionsColumn: {
            marginTop: 18,
            alignSelf: 'stretch',
        },
        actionSpacer: {
            height: 10,
        },
        checkboxRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 14,
            alignSelf: 'stretch',
        },
        checkboxLabel: {
            flex: 1,
            marginLeft: 8,
            fontSize: 14,
            color: colors.onSurface,
        },
        footerLink: {
            alignSelf: 'center',
            marginTop: 18,
            padding: 8,
        },
        flexOne: {
            flex: 1,
        },
        chipCheckIcon: {
            marginRight: 4,
        },
        buttonIcon: {
            marginRight: 6,
        },
        listHeader: {
            marginBottom: 12,
        },
        textInputSpaced: {
            marginTop: 10,
        },
        footerLinkText: {
            fontSize: 14,
            color: colors.onSurfaceMuted,
            textDecorationLine: 'underline',
        },
    });

    return {
        colors,
        styles,
    };
};

export {
    buildStyles,
};
