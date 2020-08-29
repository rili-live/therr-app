import React from 'react';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface IHeaderMenuRightDispatchProps {}

interface IStoreProps extends IHeaderMenuRightDispatchProps {}

// Regular component props
export interface IHeaderMenuRightProps extends IStoreProps {
    navigation: any;
    isVisible: boolean;
}

interface IHeaderMenuRightState {}

class HeaderMenuRight extends React.Component<
    IHeaderMenuRightProps,
    IHeaderMenuRightState
> {
    constructor(props) {
        super(props);
    }

    render() {
        const { isVisible } = this.props;

        if (isVisible) {
            return (
                <Button
                    icon={<Icon name="menu" size={30} color="white" />}
                    onPress={() => alert('This is a button!')}
                    type="clear"
                />
            );
        }

        return null;
    }
}

export default HeaderMenuRight;
