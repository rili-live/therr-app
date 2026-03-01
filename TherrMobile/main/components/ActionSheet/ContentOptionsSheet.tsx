import React from 'react';
import { View } from 'react-native';
import ActionSheet, { SheetManager, SheetProps } from 'react-native-actions-sheet';
import { Button } from '../BaseButton';
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

    return (
        <ActionSheet id={props.sheetId}>
            <View style={[
                spacingStyles.fullWidth,
                spacingStyles.alignStart,
                spacingStyles.marginTopMd,
                spacingStyles.marginBotLg,
                { paddingBottom: bottomSafeAreaInset },
            ]}>
                {options.map((option) => (
                    <Button
                        key={option.type}
                        type="clear"
                        buttonStyle={spacingStyles.justifyStart}
                        containerStyle={[spacingStyles.fullWidth]}
                        titleStyle={[payload?.themeForms.styles.buttonLink, { color: payload?.themeForms.colors.primary3 }]}
                        title={payload?.translate(`modals.contentOptions.buttons.${option.title}`)}
                        onPress={() => {
                            SheetManager.hide('content-options-sheet');
                            payload?.onSelect(option.type);
                        }}
                        icon={
                            <MaterialIcon
                                style={spacingStyles.marginRtMd}
                                name={option.icon}
                                size={22}
                                color={payload?.themeForms.colors.primary3}
                            />
                        }
                    />
                ))}
            </View>
        </ActionSheet>
    );
};

export default ContentOptionsSheet;
