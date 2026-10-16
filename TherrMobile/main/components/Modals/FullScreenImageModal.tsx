import React from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { Image } from '../BaseImage';
import { space } from '../../styles/layouts/spacing';

interface IFullScreenImageModalProps {
    // Modal is visible whenever a uri is set; pass null/undefined to close.
    imageUri?: string | null;
    onRequestClose: () => void;
    accessibilityLabel?: string;
    closeLabel: string;
}

// Lightbox for viewing a single image at full size. Tapping anywhere (or the
// Android back button) dismisses it.
const FullScreenImageModal = ({
    imageUri,
    onRequestClose,
    accessibilityLabel,
    closeLabel,
}: IFullScreenImageModalProps) => {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    return (
        <Modal
            animationType="fade"
            visible={!!imageUri}
            onRequestClose={onRequestClose}
            transparent={true}
            // Full-bleed black backdrop; insets are applied to the close button below.
            statusBarTranslucent={true}
            navigationBarTranslucent={true}
        >
            <Pressable
                style={localStyles.backdrop}
                onPress={onRequestClose}
                accessibilityRole="imagebutton"
                accessibilityLabel={accessibilityLabel}
                accessibilityHint={closeLabel}
            >
                {!!imageUri && (
                    <Image
                        source={{ uri: imageUri }}
                        width={width}
                        height={height}
                        resizeMode="contain"
                        containerStyle={localStyles.imageContainer}
                        PlaceholderContent={<ActivityIndicator size="large" color="#FFFFFF" />}
                    />
                )}
            </Pressable>
            <View style={[localStyles.closeButtonContainer, { top: insets.top + space.sm }]}>
                <Pressable
                    onPress={onRequestClose}
                    hitSlop={space.md}
                    style={localStyles.closeButton}
                    accessibilityRole="button"
                    accessibilityLabel={closeLabel}
                >
                    <MaterialIcon name="close" size={28} color="#FFFFFF" />
                </Pressable>
            </View>
        </Modal>
    );
};

const localStyles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonContainer: {
        position: 'absolute',
        right: space.md,
    },
    closeButton: {
        padding: space.xs,
        borderRadius: 999,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
});

export default FullScreenImageModal;
