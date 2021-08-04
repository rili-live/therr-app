import * as React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import buttonStyles from '../styles/buttons';

interface IFiltersButtonGroupProps {
    goToMap?: any;
    goToMoments?: any;
    translate: Function;
}

export default ({
    goToMap,
    goToMoments,
    translate,
}: IFiltersButtonGroupProps) => {
    if (!goToMap && !goToMoments) {
        throw new Error('At least one of goToMap or goToMoments function is required');
    }

    return (
        <View style={buttonStyles.buttonGroup}>
            <View style={buttonStyles.buttonGroupContainer}>
                <Button
                    buttonStyle={buttonStyles.searchFiltersButton}
                    containerStyle={buttonStyles.btnGroupButtonContainer}
                    titleStyle={buttonStyles.searchFiltersTitle}
                    title={translate('menus.filters.title')}
                    icon={
                        <MaterialIcon
                            name="tune"
                            size={23}
                            style={buttonStyles.btnIconWhite}
                        />
                    }
                />
            </View>
        </View>
    );

    // return (
    //     <View style={buttonStyles.buttonGroup}>
    //         <View style={buttonStyles.buttonGroupContainer}>
    //             {
    //                 goToMoments ?
    //                     <Button
    //                         buttonStyle={buttonStyles.mapViewToggleButton}
    //                         containerStyle={buttonStyles.leftBtnGroupButtonContainer}
    //                         icon={
    //                             <MaterialIcon
    //                                 name="list"
    //                                 size={28}
    //                                 style={buttonStyles.btnIcon}
    //                             />
    //                         }
    //                         iconRight
    //                         onPress={goToMoments}
    //                     /> :
    //                     <Button
    //                         buttonStyle={buttonStyles.mapViewToggleButton}
    //                         containerStyle={buttonStyles.leftBtnGroupButtonContainer}
    //                         icon={
    //                             <MaterialIcon
    //                                 name="public"
    //                                 size={28}
    //                                 style={buttonStyles.btnIcon}
    //                             />
    //                         }
    //                         iconRight
    //                         onPress={goToMap}
    //                     />
    //             }
    //             <Button
    //                 buttonStyle={buttonStyles.searchFiltersButton}
    //                 containerStyle={buttonStyles.rightBtnGroupButtonContainer}
    //                 icon={
    //                     <MaterialIcon
    //                         name="tune"
    //                         size={28}
    //                         style={buttonStyles.btnIcon}
    //                     />
    //                 }
    //             />
    //         </View>
    //     </View>
    // )
};
