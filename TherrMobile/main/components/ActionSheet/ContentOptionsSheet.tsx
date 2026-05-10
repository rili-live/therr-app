import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ActionSheet, { SheetManager, SheetProps } from 'react-native-actions-sheet';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import spacingStyles from '../../styles/layouts/spacing';
import { bottomSafeAreaInset } from '../../styles/navigation/buttonMenu';

export type IContentSelectionType = 'getDirections' | 'shareALink' | 'like' | 'superLike' | 'dislike' | 'superDislike' | 'report' | 'delete';

interface IContentOption {
    icon: string;
    title: string;
    type: IContentSelectionType;
}

const ANDROID_RIPPLE = { color: 'rgba(0,0,0,0.08)' };

const ContentOptionsSheet = (props: SheetProps<'content-options-sheet'>) => {
    const { payload } = props;
    const contentType = payload?.contentType;
    const shouldIncludeShareButton = !!payload?.shouldIncludeShareButton;

    const options = useMemo<IContentOption[]>(() => ([
        contentType === 'area' && { icon: 'directions', title: 'getDirections', type: 'getDirections' as const },
        contentType === 'area' && shouldIncludeShareButton && { icon: 'share', title: 'shareALink', type: 'shareALink' as const },
        { icon: 'thumb-up', title: 'superLike', type: 'superLike' as const },
        { icon: 'thumb-down', title: 'dislike', type: 'dislike' as const },
        { icon: 'thumb-down', title: 'superDislike', type: 'superDislike' as const },
        { icon: 'report-problem', title: 'report', type: 'report' as const },
    ].filter(Boolean) as IContentOption[]), [contentType, shouldIncludeShareButton]);

    const iconColor = payload?.themeForms.colors.primary3;
    const titleStyle = useMemo(() => [localStyles.title, { color: iconColor }], [iconColor]);

    return (
        <ActionSheet id={props.sheetId}>
            <View style={[
                spacingStyles.fullWidth,
                spacingStyles.marginTopMd,
                spacingStyles.marginBotLg,
                { paddingBottom: bottomSafeAreaInset },
            ]}>
                {options.map((option) => (
                    <Pressable
                        key={option.type}
                        style={localStyles.row}
                        android_ripple={ANDROID_RIPPLE}
                        onPress={() => {
                            SheetManager.hide('content-options-sheet');
                            payload?.onSelect(option.type);
                        }}
                    >
                        <MaterialIcon
                            name={option.icon}
                            size={22}
                            color={iconColor}
                            style={localStyles.icon}
                        />
                        <Text style={titleStyle}>
                            {payload?.translate(`modals.contentOptions.buttons.${option.title}`)}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </ActionSheet>
    );
};

const localStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    icon: {
        width: 40,
        textAlign: 'center',
    },
    title: {
        fontSize: 16,
        marginLeft: 4,
        flexShrink: 1,
    },
});

export default ContentOptionsSheet;
