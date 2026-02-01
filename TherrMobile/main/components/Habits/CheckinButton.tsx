import React from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { ITherrThemeColors } from '../../styles/themes';

interface ICheckinButtonProps {
    isCompleted?: boolean;
    isLoading?: boolean;
    isDisabled?: boolean;
    onPress: () => void;
    title?: string;
    completedTitle?: string;
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const CheckinButton: React.FC<ICheckinButtonProps> = ({
    isCompleted = false,
    isLoading = false,
    isDisabled = false,
    onPress,
    title = 'Check In',
    completedTitle = 'Completed!',
    themeHabits,
}) => {
    const getButtonStyle = () => {
        if (isDisabled) {
            return themeHabits.styles.checkinButtonDisabled;
        }
        if (isCompleted) {
            return themeHabits.styles.checkinButtonCompleted;
        }
        return themeHabits.styles.checkinButton;
    };

    const getIconName = () => {
        if (isCompleted) {
            return 'check-circle';
        }
        return 'add-circle';
    };

    return (
        <Pressable
            style={[themeHabits.styles.checkinButtonContainer, getButtonStyle()]}
            onPress={onPress}
            disabled={isDisabled || isLoading || isCompleted}
        >
            {isLoading ? (
                <ActivityIndicator color={themeHabits.colors.brandingWhite} size="small" />
            ) : (
                <>
                    <MaterialIcon
                        name={getIconName()}
                        size={24}
                        style={themeHabits.styles.checkinButtonIcon}
                    />
                    <Text style={themeHabits.styles.checkinButtonText}>
                        {isCompleted ? completedTitle : title}
                    </Text>
                </>
            )}
        </Pressable>
    );
};

export default CheckinButton;
