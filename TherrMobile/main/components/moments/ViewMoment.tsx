import React from 'react';
import { connect } from 'react-redux';
import { ActivityIndicator, View, ScrollView, Text } from 'react-native';
import { Button, Image } from 'react-native-elements';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { IUserState } from 'therr-react/types';
import { viewMomentModal } from '../../styles/modal';
import { bindActionCreators } from 'redux';

export const DEFAULT_RADIUS = 10;

interface IMomentDetails {
    userDetails?: any;
}

interface IViewMomentDispatchProps {}

interface IStoreProps extends IViewMomentDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IViewMomentProps extends IStoreProps {
    closeOverlay: any;
    moment: any;
    momentDetails: IMomentDetails;
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
        const { closeOverlay, moment, momentDetails } = this.props;

        return (
            <>
                <View style={viewMomentModal.header}>
                    <Button
                        icon={
                            <Icon
                                name="close"
                                size={30}
                                color="black"
                                style={viewMomentModal.headerTitleIcon}
                            />
                        }
                        onPress={closeOverlay}
                        type="clear"
                    />
                </View>
                <ScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    ref={(component) => (this.scrollViewRef = component)}
                    style={viewMomentModal.body}
                >
                    <View style={viewMomentModal.momentContainer}>
                        <Image
                            source={{ uri: `https://robohash.org/${moment.fromUserId}?size=200x200` }}
                            style={viewMomentModal.momentUserAvatarImg}
                            PlaceholderContent={<ActivityIndicator />}
                        />
                        {
                            momentDetails.userDetails &&
                            <Text style={viewMomentModal.momentUserName}>{`${momentDetails.userDetails.firstName} ${momentDetails.userDetails.lastName}`}</Text>
                        }
                        <Text style={viewMomentModal.momentMessage}>{moment.message}</Text>
                    </View>
                </ScrollView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewMoment);
