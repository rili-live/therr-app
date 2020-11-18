import React from 'react';
import { View, Text } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { editMomentModal } from '../../styles/modal';

interface IEditMomentDispatchProps {}

interface IStoreProps extends IEditMomentDispatchProps {}

// Regular component props
export interface IEditMomentProps extends IStoreProps {
    closeOverlay: any
    translate: any;
}

interface IEditMomentState {}

class EditMoment extends React.Component<IEditMomentProps, IEditMomentState> {
    constructor(props) {
        super(props);

        this.state = {};
    }


    render() {
        const { closeOverlay, translate } = this.props;

        return (
            <>
                <View style={editMomentModal.header}>
                    <View style={editMomentModal.headerTitle}>
                        <Text style={editMomentModal.headerTitleText}>
                            {translate('components.momentsOverlay.headerTitle')}
                        </Text>
                    </View>
                    <Button
                        icon={
                            <FontAwesomeIcon
                                name="times"
                                size={30}
                                color="black"
                            />
                        }
                        onPress={closeOverlay}
                        type="clear"
                    />
                </View>
                <View style={editMomentModal.body} />
                <View style={editMomentModal.footer} />
            </>
        );
    }
}

export default EditMoment;
