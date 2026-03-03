import React from 'react';
import { View } from 'react-native';
import ActionSheet, { SheetManager, SheetProps } from 'react-native-actions-sheet';
import { List } from 'react-native-paper';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import spacingStyles from '../../styles/layouts/spacing';
import { bottomSafeAreaInset } from '../../styles/navigation/buttonMenu';

export type IContentSelectionType = 'getDirections' | 'shareALink' | 'like' | 'superLike' | 'dislike' | 'superDislike' | 'report' | 'delete';

interface IContentOption {
    icon: string;
    title: string;
    type: IContentSelectionType;
}

const ContentOptionsSheet = (props: SheetProps<'content-options-sheet'>) => {
    const { payload } = props;
    const contentType = payload?.contentType;

    const allOptions: (IContentOption | false)[] = [
        contentType === 'area' && { icon: 'directions', title: 'getDirections', type: 'getDirections' as const },
        contentType === 'area' && !!payload?.shouldIncludeShareButton && { icon: 'share', title: 'shareALink', type: 'shareALink' as const },
        { icon: 'thumb-up', title: 'superLike', type: 'superLike' as const },
        { icon: 'thumb-down', title: 'dislike', type: 'dislike' as const },
        { icon: 'thumb-down', title: 'superDislike', type: 'superDislike' as const },
        { icon: 'report-problem', title: 'report', type: 'report' as const },
    ];

    const options = allOptions.filter(Boolean) as IContentOption[];
    const iconColor = payload?.themeForms.colors.primary3;

    return (
        <ActionSheet id={props.sheetId}>
            <View style={[
                spacingStyles.fullWidth,
                spacingStyles.marginTopMd,
                spacingStyles.marginBotLg,
                { paddingBottom: bottomSafeAreaInset },
            ]}>
                {options.map((option) => (
                    <List.Item
                        key={option.type}
                        title={payload?.translate(`modals.contentOptions.buttons.${option.title}`)}
                        titleStyle={{ color: iconColor }}
                        left={(listProps) => (
                            <MaterialIcon
                                name={option.icon}
                                size={22}
                                color={iconColor}
                                style={listProps.style}
                            />
                        )}
                        onPress={() => {
                            SheetManager.hide('content-options-sheet');
                            payload?.onSelect(option.type);
                        }}
                    />
                ))}
            </View>
        </ActionSheet>
    );
};

export default ContentOptionsSheet;
