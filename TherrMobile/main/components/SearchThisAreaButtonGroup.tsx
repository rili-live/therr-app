import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { FAB } from 'react-native-paper';
import searchLoading from '../assets/search-loading.json';
import LottieView from 'lottie-react-native';

interface ISearchThisAreaButtonGroupProps {
    handleSearchLocation?: any;
    isSearchLoading: boolean;
    translate: Function;
    themeButtons: {
        styles: any;
        colors: any;
    };
}

const SearchThisAreaButtonGroup = ({
    handleSearchLocation,
    isSearchLoading,
    translate,
    themeButtons,
}: ISearchThisAreaButtonGroupProps) => {

    return (
        <View style={themeButtons.styles.buttonGroupTop}>
            {
                isSearchLoading ?
                    <LottieView
                        source={searchLoading}
                        resizeMode="contain"
                        speed={1}
                        autoPlay
                        loop
                        style={[localStyles.searchLoadingLottie]}
                    /> :
                    <FAB
                        icon="magnify"
                        label={translate('menus.searchThisArea.title')}
                        onPress={() => handleSearchLocation()}
                        style={themeButtons.styles.searchThisAreaButton}
                        color={themeButtons.colors.brandingWhite}
                        size="small"
                    />
            }
        </View>
    );
};

const localStyles = StyleSheet.create({
    searchLoadingLottie: {
        position: 'absolute',
        top: 0,
        width: '100%',
        height: 65,
    },
});

export default React.memo(SearchThisAreaButtonGroup);
