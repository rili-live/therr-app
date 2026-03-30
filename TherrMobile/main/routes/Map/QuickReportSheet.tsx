import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Categories } from 'therr-js-utilities/constants';
import { showToast } from '../../utilities/toasts';
import { ITherrThemeColors } from '../../styles/themes';

const { CategoriesMap } = Categories;

interface IQuickReportOption {
    category: string;
    labelKey: string;
    icon: string;
    iconSet: 'material' | 'ionicons';
}

const quickReportOptions: IQuickReportOption[] = [
    { category: CategoriesMap[30], labelKey: 'quickReports.happeningNow', icon: 'local-fire-department', iconSet: 'material' },
    { category: CategoriesMap[31], labelKey: 'quickReports.longWait', icon: 'hourglass-top', iconSet: 'material' },
    { category: CategoriesMap[32], labelKey: 'quickReports.liveEntertainment', icon: 'musical-notes', iconSet: 'ionicons' },
    { category: CategoriesMap[33], labelKey: 'quickReports.crowdAlert', icon: 'people', iconSet: 'material' },
    { category: CategoriesMap[34], labelKey: 'quickReports.hiddenGem', icon: 'diamond', iconSet: 'ionicons' },
    { category: CategoriesMap[35], labelKey: 'quickReports.localDeal', icon: 'local-offer', iconSet: 'material' },
];

interface IQuickReportSheetProps {
    circleCenter: { latitude: number; longitude: number };
    createMoment: (data: any) => Promise<any>;
    nearbySpaces: { id: string; title: string }[];
    onClose?: () => void;
    translate: Function;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
        textAlign: 'center',
    },
    nearbySpaceLabel: {
        fontSize: 12,
        marginBottom: 12,
        textAlign: 'center',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    reportButton: {
        width: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        marginBottom: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    reportButtonDisabled: {
        opacity: 0.5,
    },
    reportButtonIcon: {
        marginRight: 10,
    },
    reportButtonLabel: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    detailsInput: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginTop: 12,
        fontSize: 14,
    },
    loadingOverlay: {
        position: 'absolute',
        right: 8,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
    },
});

const QuickReportSheet = ({
    circleCenter,
    createMoment,
    nearbySpaces,
    onClose,
    translate,
    theme,
}: IQuickReportSheetProps) => {
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const nearestSpace = nearbySpaces?.length > 0 ? nearbySpaces[0] : null;

    const handleSubmitReport = (option: IQuickReportOption) => {
        if (isSubmitting) return;

        setIsSubmitting(true);

        const momentData = {
            category: option.category,
            latitude: circleCenter.latitude,
            longitude: circleCenter.longitude,
            isPublic: true,
            message: details || '',
            notificationMsg: details || translate(option.labelKey),
            spaceId: nearestSpace?.id,
        };

        createMoment(momentData)
            .then(() => {
                showToast.success({
                    text1: translate('quickReports.submitSuccess'),
                    text2: nearestSpace
                        ? `${translate(option.labelKey)} @ ${nearestSpace.title}`
                        : translate(option.labelKey),
                });
                setDetails('');
                if (onClose) {
                    onClose();
                }
            })
            .catch(() => {
                showToast.error({
                    text1: translate('quickReports.submitError'),
                });
            })
            .finally(() => {
                setIsSubmitting(false);
            });
    };

    const renderIcon = (option: IQuickReportOption) => {
        const iconColor = isSubmitting ? theme.colors.textGray : theme.colors.primary3;
        if (option.iconSet === 'ionicons') {
            return <Ionicons name={option.icon} size={22} color={iconColor} style={styles.reportButtonIcon} />;
        }
        return <MaterialIcon name={option.icon} size={22} color={iconColor} style={styles.reportButtonIcon} />;
    };

    return (
        <View style={styles.container}>
            <Text style={[styles.title, { color: theme.colors.textBlack }]}>
                {translate('quickReports.title')}
            </Text>
            {nearestSpace && (
                <Text style={[styles.nearbySpaceLabel, { color: theme.colors.textGray }]}>
                    {`@ ${nearestSpace.title}`}
                </Text>
            )}
            <View style={styles.grid}>
                {quickReportOptions.map((option) => (
                    <Pressable
                        key={option.category}
                        style={[
                            styles.reportButton,
                            {
                                borderColor: theme.colors.primary3,
                                backgroundColor: theme.colors.backgroundWhite,
                            },
                            isSubmitting && styles.reportButtonDisabled,
                        ]}
                        onPress={() => handleSubmitReport(option)}
                        disabled={isSubmitting}
                    >
                        {renderIcon(option)}
                        <Text style={[styles.reportButtonLabel, { color: theme.colors.textBlack }]}>
                            {translate(option.labelKey)}
                        </Text>
                    </Pressable>
                ))}
            </View>
            <TextInput
                style={[styles.detailsInput, {
                    borderColor: theme.colors.textGray,
                    color: theme.colors.textBlack,
                    backgroundColor: theme.colors.backgroundWhite,
                }]}
                placeholder={translate('quickReports.addDetails')}
                placeholderTextColor={theme.colors.textGray}
                value={details}
                onChangeText={setDetails}
                maxLength={140}
                editable={!isSubmitting}
            />
            {isSubmitting && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="small" color={theme.colors.primary3} />
                </View>
            )}
        </View>
    );
};

export default QuickReportSheet;
