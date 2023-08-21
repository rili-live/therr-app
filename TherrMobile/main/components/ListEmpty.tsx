import React from 'react';
import { View, Text } from 'react-native';
import spacingStyles from '../styles/layouts/spacing';
import TherrIcon from '../components/TherrIcon';

interface IListEmptyProps {
    theme: any;
    text: any;
    iconName?: string;
}

const ListEmpty = ({
    theme,
    text,
    iconName,
}: IListEmptyProps) => (
    <View style={theme.styles.sectionContainer}>
        {
            iconName &&
            <View style={[
                spacingStyles.fullWidth,
                spacingStyles.flex,
                spacingStyles.alignCenter,
                spacingStyles.marginBotLg,
            ]}>
                <TherrIcon
                    style={theme.styles.iconStyle}
                    name={iconName}
                    size={50}
                />
            </View>
        }
        <Text style={theme.styles.sectionDescriptionCentered}>
            {text}
        </Text>
    </View>
);

export default ListEmpty;
