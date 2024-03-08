import React, { useState } from 'react';
import { Pressable, StyleProp, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { ITherrThemeColors } from '../../styles/themes';
import { TextStyle } from 'react-native';

interface ISpaceRating {
    initialRating?: number;
    isEditable?: boolean;
    onSelectRating?: (rating: number) => any;
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
    starSize?: number;
    style?: StyleProp<TextStyle>;
}

const SpaceRating = ({
    isEditable,
    onSelectRating,
    themeForms,
    initialRating,
    starSize,
    style,
}: ISpaceRating) => {
    const [rating, setRating] = useState<undefined | number>(initialRating);
    const star = starSize || 40;

    const handlePress = (rating: number) => () => {
        if (!isEditable || !onSelectRating) {
            return;
        }

        setRating(rating);

        onSelectRating(rating);
    };

    return <View style={[
        themeForms.styles.ratingContainer,
        style,
    ]}>
        {
            [1,2,3,4,5].map((num) => (
                <Pressable onPress={handlePress(num)}>
                    <MaterialIcon
                        name={rating && num <= rating ? 'star' : 'star-border'}
                        size={star}
                        style={{ color: rating === null ? themeForms.colors.textGray : themeForms.colors.ternary2 }}
                    />
                </Pressable>
            ))

        }
    </View>;
};

export default SpaceRating;
