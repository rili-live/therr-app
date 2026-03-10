import { ITherrThemeColors } from '../../../styles/themes';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ListItem } from '../../../components/BaseListItem';
import 'react-native-gesture-handler';

interface IPhoneContactItemProps {
    contactDetails: any;
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
    onPress,
    onActionPress,
    actionLabel,
    theme,
}) => {
    const handlePress = () => {
        if (onActionPress) {
            // For "not on app" contacts, tapping row toggles checkbox
            onPress(contactDetails.recordID);
        } else {
            // For "on app" contacts, tapping row triggers connect
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
            {onActionPress ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ListItem.CheckBox
                        checked={contactDetails.isChecked}
                        onPress={() => onPress(contactDetails.recordID)}
                        checkedColor={theme.colors.brandingBlueGreen}
                    />
                    <TouchableOpacity
                        onPress={onActionPress}
                        style={{
                            backgroundColor: theme.colors.brandingBlueGreen,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 16,
                            marginLeft: 8,
                        }}
                    >
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                            {actionLabel}
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity
                    onPress={() => onPress(contactDetails)}
                    style={{
                        backgroundColor: theme.colors.brandingBlueGreen,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
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
