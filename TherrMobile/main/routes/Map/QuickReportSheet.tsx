import React, { useState } from 'react';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Categories } from 'therr-js-utilities/constants';
import showToast from '../../components/ToastConfig';
import { ITherrThemeColors } from '../../styles/themes';

const { CategoriesMap, QuickReportCategories } = Categories;

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
    translate: Function;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
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
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginBottom: 10,
        borderRadius: 12,
        borderWidth: 1,
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
        marginTop: 8,
        marginBottom: 4,
        fontSize: 14,
    },
    nearbySpaceLabel: {
        fontSize: 12,
        marginTop: 4,
        marginBottom: 8,
    },
});

const QuickReportSheet = ({
    circleCenter,
    createMoment,
    nearbySpaces,
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
        const iconColor = theme.colors.primary3;
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
            <TextInput
                style={[styles.detailsInput, {
                    borderColor: theme.colors.textGray,
                    color: theme.colors.textBlack,
                }]}
                placeholder={translate('quickReports.addDetails')}
                placeholderTextColor={theme.colors.textGray}
                value={details}
                onChangeText={setDetails}
                maxLength={140}
            />
            <View style={styles.grid}>
                {quickReportOptions.map((option) => (
                    <Pressable
                        key={option.category}
                        style={[styles.reportButton, {
                            borderColor: theme.colors.primary3,
                            backgroundColor: theme.colors.brandingWhite,
                        }]}
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
        </View>
    );
};

export default QuickReportSheet;
