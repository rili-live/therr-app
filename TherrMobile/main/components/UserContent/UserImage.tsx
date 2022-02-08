import React from 'react';
import { Pressable, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import mixins from '../../styles/mixins';
import Image from '../../components/BaseImage';

export default ({
    onPress,
    theme,
    userImageUri,
}) => {
    return (
        <Pressable
            onPress={onPress}
            style={{
                position: 'relative',
            }}
        >
            <View style={[mixins.flexCenter, mixins.marginMediumBot]}>
                <View>
                    <Image source={{ uri: userImageUri }} loaderSize="large" theme={theme} style={{
                        height: 200,
                        width: 200,
                        borderRadius: 100,
                    }} />
                    <View
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            backgroundColor: theme.colorVariations.backgroundBlackFade,
                            borderRadius: 40,
                            padding: 14,
                        }}
                    >
                        <MaterialIcon
                            name="add-a-photo"
                            size={40}
                            color={theme.colors.accentTextWhite}
                        />
                    </View>
                </View>
            </View>
        </Pressable>
    );
};
