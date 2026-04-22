import { ITherrThemeColors } from '../../../styles/themes';
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { ListItem } from '../../../components/BaseListItem';
import 'react-native-gesture-handler';

interface IPhoneContactItemProps {
    contactDetails: any;
    isCheckable?: boolean;
    onPress: any;
    onActionPress?: () => void;
    actionLabel?: string;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    }
}

const PhoneContactItem: React.FunctionComponent<IPhoneContactItemProps> = ({
    contactDetails,
    isCheckable,
    onPress,
    onActionPress,
    actionLabel,
    theme,
}) => {
    const handlePress = () => {
        if (isCheckable) {
            // For "not on app" contacts, tapping row toggles checkbox
            onPress(contactDetails.recordID);
        } else {
            // For "on app" contacts, tapping row navigates to profile
            onPress(contactDetails);
        }
    };

    return (
        <ListItem
            onPress={handlePress}
            bottomDivider
            containerStyle={theme.styles.listItemCard}
        >
            <ListItem.Content>
                <ListItem.Title>{`${contactDetails.givenName} ${contactDetails.familyName}`}</ListItem.Title>
            </ListItem.Content>
            {isCheckable && (
                <ListItem.CheckBox
                    checked={contactDetails.isChecked}
                    onPress={() => onPress(contactDetails.recordID)}
                    checkedColor={theme.colors.brandingBlueGreen}
                />
            )}
            {onActionPress && (
                <TouchableOpacity
                    onPress={onActionPress}
                    style={{
                        backgroundColor: theme.colors.brandingBlueGreen,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                        marginLeft: isCheckable ? 8 : 0,
                    }}
                >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                        {actionLabel}
                    </Text>
                </TouchableOpacity>
            )}
        </ListItem>
    );
};

export default PhoneContactItem;
