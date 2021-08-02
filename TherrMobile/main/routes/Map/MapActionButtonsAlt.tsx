import * as React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import OctIcon from 'react-native-vector-icons/Octicons';
import buttonStyles from '../../styles/buttons';

export default ({
    handleCreateMoment,
    handleCompassRealign,
    isAuthorized,
    isMapView,
    goToNotifications,
}) => {
    const shouldShowCreateButton = isAuthorized();

    return (
        <>
            <View style={buttonStyles.notifications}>
                <Button
                    buttonStyle={buttonStyles.btn}
                    icon={
                        <MaterialIcon
                            name="bell"
                            size={28}
                            style={buttonStyles.btnIcon}
                        />
                    }
                    raised={true}
                    onPress={() => goToNotifications()}
                />
            </View>
            {
                shouldShowCreateButton &&
                    <View style={buttonStyles.addMoment}>
                        <Button
                            buttonStyle={buttonStyles.btn}
                            icon={
                                <OctIcon
                                    name="device-camera"
                                    size={44}
                                    style={buttonStyles.btnIcon}
                                />
                            }
                            raised={true}
                            onPress={handleCreateMoment}
                        />
                    </View>
            }
            <View style={buttonStyles.locationEnable}>
                <Button
                    buttonStyle={buttonStyles.btn}
                    icon={
                        <FontAwesomeIcon
                            name="compass"
                            size={28}
                            style={buttonStyles.btnIcon}
                        />
                    }
                    raised={true}
                    onPress={handleCompassRealign}
                />
            </View>
            <View style={buttonStyles.buttonGroup}>
                {
                    isMapView ?
                        <Button
                            buttonStyle={buttonStyles.mapViewToggleButton}
                            containerStyle={buttonStyles.mapViewToggle}
                            icon={
                                <FontAwesomeIcon
                                    name="globe"
                                    size={22}
                                    style={buttonStyles.btnIcon}
                                />
                            }
                            iconRight
                            onPress={handleCompassRealign}
                        /> :
                        <Button
                            buttonStyle={buttonStyles.searchFiltersButton}
                            containerStyle={buttonStyles.searchFilters}
                            icon={
                                <FontAwesomeIcon
                                    name="filters"
                                    size={22}
                                    style={buttonStyles.btnIcon}
                                />
                            }
                            iconRight
                            raised={true}
                            onPress={handleCompassRealign}
                        />
                }
                <Button
                    buttonStyle={buttonStyles.btn}
                    icon={
                        <FontAwesomeIcon
                            name="filters"
                            size={28}
                            style={buttonStyles.btnIcon}
                        />
                    }
                    raised={true}
                    onPress={handleCompassRealign}
                />
            </View>
        </>
    );
};
