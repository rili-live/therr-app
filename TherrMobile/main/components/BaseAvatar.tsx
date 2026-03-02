import React, { useState } from 'react';
import { Avatar as PaperAvatar } from 'react-native-paper';

// Adapter that maps the react-native-elements Avatar API to Paper's
// Avatar.Image / Avatar.Text. Preserves the same prop interface so
// consumers work without changes beyond swapping the import.

const SIZE_MAP: Record<string, number> = {
    small: 34,
    medium: 50,
    large: 75,
    xlarge: 150,
};

interface IAvatarProps {
    title?: string;
    rounded?: boolean; // Accepted but ignored — Paper avatars are always circular
    source?: { uri?: string };
    size?: 'small' | 'medium' | 'large' | 'xlarge' | number;
    containerStyle?: any; // Silently ignored for compat
}

export const Avatar = ({ title, source, size = 'medium' }: IAvatarProps) => {
    const [imageError, setImageError] = useState(false);
    const numericSize = typeof size === 'number' ? size : (SIZE_MAP[size] || 50);

    if (source?.uri && !imageError) {
        return (
            <PaperAvatar.Image
                size={numericSize}
                source={{ uri: source.uri }}
                onError={() => setImageError(true)}
            />
        );
    }

    return (
        <PaperAvatar.Text
            size={numericSize}
            label={title || '?'}
        />
    );
};

export default Avatar;
