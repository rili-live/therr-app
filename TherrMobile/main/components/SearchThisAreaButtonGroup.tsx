import * as React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import searchLoading from '../assets/search-loading.json';
import LottieView from 'lottie-react-native';

interface ISearchThisAreaButtonGroupProps {
    handleSearchLocation?: any;
    isSearchLoading: boolean;
    translate: Function;
    themeButtons: {
        styles: any;
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
                        // resizeMode="cover"
                        resizeMode="contain"
                        speed={1}
                        autoPlay
                        loop
                        style={[{position: 'absolute', top: 0, width: '100%', height: 65}]}
                    /> :
                    <Button
                        onPress={() => handleSearchLocation()}
                        buttonStyle={themeButtons.styles.searchThisAreaButton}
                        containerStyle={themeButtons.styles.btnContainer}
                        titleStyle={themeButtons.styles.searchThisAreaTitle}
                        title={translate('menus.searchThisArea.title')}
                        raised
                    />
            }
        </View>
    );
};

export default React.memo(SearchThisAreaButtonGroup);
