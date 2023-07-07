import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { ITherrThemeColors } from '../../styles/themes';

interface ISpaceRating {
    isEditable: boolean;
    onSelectRating: (rating: number) => any;
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const SpaceRating = ({
    isEditable,
    onSelectRating,
    themeForms,
}: ISpaceRating) => {
    const [rating, setRating] = useState<null | number>(null);

    const handlePress = (rating: number) => () => {
        if (!isEditable) {
            return;
        }

        setRating(rating);

        onSelectRating(rating);
    };

    return <View style={themeForms.styles.ratingContainer}>
        {
            [1,2,3,4,5].map((num) => (
                <Pressable onPress={handlePress(num)}>
                    <MaterialIcon
                        name={rating && num <= rating ? 'star' : 'star-border'}
                        size={40}
                        style={{ color: rating === null ? themeForms.colors.textGray : themeForms.colors.textWhite }}
                    />
                </Pressable>
            ))

        }
    </View>;
};

export default SpaceRating;
