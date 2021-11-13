import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import momentStyles from '../../styles/user-content/moments';
import * as therrTheme from '../../styles/themes';
import { CAROUSEL_TABS } from '../../constants';

interface ICarouselTabsMenuDispatchProps {
}

interface IStoreProps extends ICarouselTabsMenuDispatchProps {
}

// Regular component props
export interface ICarouselTabsMenuProps extends IStoreProps {
    activeTab: string;
    onButtonPress: Function;
    translate: Function;
    user: any;
}

interface ICarouselTabsMenuState {}

export const mapStateToProps = (state: any) => ({
    location: state.location,
    notifications: state.notifications,
});

export const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {},
        dispatch
    );

export class CarouselTabsMenu extends React.Component<ICarouselTabsMenuProps, ICarouselTabsMenuState> {
    constructor(props) {
        super(props);

        this.state = {};
    }

    getButtonStyles = (name) => {
        const { activeTab } = this.props;

        if (name === activeTab) {
            return {
                backgroundColor: therrTheme.colors.primary3,
            };
        }

        return {};
    }

    render() {
        const { onButtonPress } = this.props;
        const momentCarouselTab = {
            ...momentStyles.momentCarouselTab,
            width: '30%',
        };
        const momentCarouselTabButton = {
            backgroundColor: therrTheme.colors.primary,
            paddingTop: 2,
            paddingBottom: 3,
            borderRadius: 9,
        };

        return (
            <View style={momentStyles.momentCarouselHeader}>
                <Button
                    buttonStyle={[momentCarouselTabButton, this.getButtonStyles(CAROUSEL_TABS.SOCIAL)]}
                    containerStyle={momentCarouselTab}
                    title="Social"
                    onPress={() => onButtonPress(CAROUSEL_TABS.SOCIAL)}
                />
                <Button
                    buttonStyle={[momentCarouselTabButton, this.getButtonStyles(CAROUSEL_TABS.HIRE)]}
                    containerStyle={momentCarouselTab}
                    title="Hire"
                    onPress={() => onButtonPress(CAROUSEL_TABS.HIRE)}
                />
                <Button
                    buttonStyle={[momentCarouselTabButton, this.getButtonStyles(CAROUSEL_TABS.EVENTS)]}
                    containerStyle={momentCarouselTab}
                    title="Events"
                    onPress={() => onButtonPress(CAROUSEL_TABS.EVENTS)}
                />
            </View>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(CarouselTabsMenu);
