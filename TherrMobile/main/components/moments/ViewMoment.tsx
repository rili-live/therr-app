import React from 'react';
import { connect } from 'react-redux';
import { ActivityIndicator, View, ScrollView, Text } from 'react-native';
import { Button, Image } from 'react-native-elements';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { IUserState } from 'therr-react/types';
import { editMomentModal } from '../../styles/modal';
import { editMomentForm as editMomentFormStyles } from '../../styles/forms';
import { bindActionCreators } from 'redux';

export const DEFAULT_RADIUS = 10;

interface IViewMomentDispatchProps {}

interface IStoreProps extends IViewMomentDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IViewMomentProps extends IStoreProps {
    closeOverlay: any;
    moment: any;
    translate: any;
}

interface IViewMomentState {}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({}, dispatch);

class ViewMoment extends React.Component<IViewMomentProps, IViewMomentState> {
    private scrollViewRef;

    constructor(props) {
        super(props);

        this.state = {};
    }

    render() {
        const { closeOverlay, moment } = this.props;

        return (
            <>
                <View style={editMomentModal.header}>
                    <Button
                        icon={
                            <Icon
                                name="close"
                                size={30}
                                color="black"
                            />
                        }
                        onPress={closeOverlay}
                        type="clear"
                    />
                </View>
                <ScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    ref={(component) => (this.scrollViewRef = component)}
                    style={editMomentModal.body}
                >
                    <View style={editMomentFormStyles.momentContainer}>
                        <Image
                            source={{ uri: `https://robohash.org/${moment.fromUserId}?size=200x200` }}
                            style={{ width: 200, height: 200 }}
                            PlaceholderContent={<ActivityIndicator />}
                        />
                        <Text>{moment.notificationMsg}</Text>
                        <Text>{moment.message}</Text>
                    </View>
                </ScrollView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewMoment);
