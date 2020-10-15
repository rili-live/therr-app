import React from 'react';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface IHeaderMenuLeftDispatchProps {}

interface IStoreProps extends IHeaderMenuLeftDispatchProps {}

// Regular component props
export interface IHeaderMenuLeftProps extends IStoreProps {
    navigation: any;
}

interface IHeaderMenuLeftState {}

class HeaderMenuLeft extends React.Component<
    IHeaderMenuLeftProps,
    IHeaderMenuLeftState
> {
    constructor(props) {
        super(props);

        this.state = {};
    }

    handlePress = () => {
        const { navigation } = this.props;
        navigation.navigate('Home');
    };

    render() {
        return (
            <Button
                type="clear"
                icon={
                    <Icon
                        name="public"
                        size={30}
                        color="white"
                        onPress={this.handlePress}
                    />
                }
            />
        );
    }
}

export default HeaderMenuLeft;
