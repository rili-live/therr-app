import React from 'react';
import { Pressable, Text, ActivityIndicator, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { ITherrThemeColors } from '../../styles/themes';

interface ICheckinButtonProps {
    isCompleted?: boolean;
    isLoading?: boolean;
    isDisabled?: boolean;
    onPress: () => void;
    title?: string;
    completedTitle?: string;
    /**
     * "Add a note or photo." When provided, a persistent secondary action is
     * shown once the day is checked in — the only way back into the proof sheet
     * that survives the success toast being missed or dismissed. Confirming it
     * re-POSTs the same (habitGoalId, date) pair, which the users-service upsert
     * merges onto the existing row without re-crediting the streak. Omit it and
     * the button behaves exactly as before.
     */
    onAddDetail?: () => void;
    addDetailTitle?: string;
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
    onAddDetail,
    addDetailTitle = 'Add a note or photo',
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

    const button = (
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

    // The check-in commits on the first tap and the proof sheet is only offered
    // from the success toast, which is transient. Once the day is done, keep a
    // standing entry point to attach a note or photo so an accidentally-closed
    // (or missed) sheet is not a dead end.
    if (isCompleted && onAddDetail) {
        return (
            <View style={themeHabits.styles.checkinButtonWithDetailContainer}>
                {button}
                <Pressable
                    style={({ pressed }) => [
                        themeHabits.styles.checkinAddDetailButton,
                        pressed && themeHabits.styles.pressedOpacity,
                    ]}
                    onPress={onAddDetail}
                    disabled={isLoading}
                    accessibilityRole="button"
                    accessibilityLabel={addDetailTitle}
                >
                    <MaterialIcon
                        name="add-a-photo"
                        size={16}
                        style={themeHabits.styles.checkinAddDetailIcon}
                    />
                    <Text style={themeHabits.styles.checkinAddDetailText}>
                        {addDetailTitle}
                    </Text>
                </Pressable>
            </View>
        );
    }

    return button;
};

export default CheckinButton;
