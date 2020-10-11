import React from 'react';
import { View } from 'react-native';
import { Button, Overlay, Text } from 'react-native-elements';
import { CommonActions } from '@react-navigation/native';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { headerMenuModal } from '../styles/modal';

interface IHeaderMenuRightDispatchProps {}

interface IStoreProps extends IHeaderMenuRightDispatchProps {}

// Regular component props
export interface IHeaderMenuRightProps extends IStoreProps {
    logout: Function;
    navigation: any;
    isVisible: boolean;
    user: any;
}

interface IHeaderMenuRightState {
    isModalVisible: boolean;
}

class HeaderMenuRight extends React.Component<
    IHeaderMenuRightProps,
    IHeaderMenuRightState
> {
    constructor(props) {
        super(props);

        this.state = {
            isModalVisible: false,
        };
    }

    toggleOverlay = () => {
        const { isModalVisible } = this.state;

        this.setState({
            isModalVisible: !isModalVisible,
        });
    };

    navTo = (routeName) => {
        const { navigation } = this.props;

        this.toggleOverlay();
        navigation.navigate(routeName);
    };

    handleLogout = () => {
        const { user, logout, navigation } = this.props;

        logout(user.details)
            .then(() => {
                navigation.dispatch(
                    CommonActions.reset({
                        index: 1,
                        routes: [
                            {
                                name: 'Login',
                            },
                        ],
                    })
                );
            })
            .catch((e) => {
                console.log(e);
            });
    };

    render() {
        const { isVisible } = this.props;
        const { isModalVisible } = this.state;

        if (isVisible) {
            return (
                <>
                    <Button
                        icon={<Icon name="menu" size={30} color="white" />}
                        onPress={this.toggleOverlay}
                        type="clear"
                    />
                    <Overlay
                        isVisible={isModalVisible}
                        onBackdropPress={this.toggleOverlay}
                        overlayStyle={headerMenuModal.container}
                    >
                        <>
                            <View style={headerMenuModal.header}>
                                <Text style={headerMenuModal.headerTitle} />
                                <Button
                                    icon={
                                        <Icon
                                            name="close"
                                            size={30}
                                            color="#388254"
                                        />
                                    }
                                    onPress={this.toggleOverlay}
                                    type="clear"
                                />
                            </View>
                            <Button
                                titleStyle={headerMenuModal.buttons}
                                buttonStyle={headerMenuModal.buttons}
                                title="HOME"
                                onPress={() => this.navTo('Home')}
                            />
                            <Button
                                titleStyle={headerMenuModal.buttons}
                                buttonStyle={headerMenuModal.buttons}
                                title="MAP"
                                onPress={() => this.navTo('Map')}
                            />
                            <Button
                                titleStyle={headerMenuModal.buttons}
                                buttonStyle={headerMenuModal.buttons}
                                title="LOGOUT"
                                onPress={this.handleLogout}
                            />
                        </>
                    </Overlay>
                </>
            );
        }

        return null;
    }
}

export default HeaderMenuRight;
