import React from 'react';
import { View, Pressable } from 'react-native';
import OctIcon from 'react-native-vector-icons/Octicons';
import { AreaDisplayContent } from '../../components/UserContent/AreaDisplayMedium';

interface ICompactSpaceCardProps {
    space: any;
    areaMedia: any;
    isSelected: boolean;
    onSelect: (space: any) => void;
    onInspect: (space: any) => void;
    isDarkMode: boolean;
    theme: any;
    themeForms: any;
    themeViewArea: any;
    translate: Function;
}

const CompactSpaceCard = ({
    space,
    areaMedia,
    isSelected,
    onSelect,
    onInspect,
    isDarkMode,
    theme,
    themeForms,
    themeViewArea,
    translate,
}: ICompactSpaceCardProps) => (
    <Pressable
        style={[
            isSelected
                ? theme.styles.areaContainerButtonSelected
                : theme.styles.areaContainerButton,
        ]}
        onPress={() => onSelect(space)}
    >
        <AreaDisplayContent
            hashtags={space.hashTags ? space.hashTags.split(',') : []}
            isDarkMode={isDarkMode}
            area={space}
            areaMedia={areaMedia}
            inspectContent={() => onInspect(space)}
            theme={theme}
            themeForms={themeForms}
            themeViewArea={themeViewArea}
            translate={translate}
        />
        <View style={{ width: 30 }}>
            <OctIcon
                name={isSelected ? 'check' : 'circle'}
                size={18}
                color={isSelected ? theme.colors.primary3 : theme.colors.accentDivider}
            />
        </View>
    </Pressable>
);

export default CompactSpaceCard;
