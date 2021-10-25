import React from 'react';
import { Pressable, Text } from 'react-native';
import { connect } from 'react-redux';
import 'react-native-gesture-handler';
import { FlatListHeaderTabs, mapStateToProps, mapDispatchToProps } from './';
import buttonStyles from '../../styles/navigation/buttonMenu';

class MessagesContactsTab extends FlatListHeaderTabs {
    constructor(props) {
        super(props);
    }

    handleButtonPress = (name: string) => {
        const { onButtonPress } = this.props;

        this.navTo(name);

        onButtonPress && onButtonPress(name);
    };

    render() {
        const { tabName, translate } = this.props;

        return (
            <FlatListHeaderTabs {...this.props}>
                <>
                    <Pressable
                        onPress={() => this.handleButtonPress('ActiveConnections')}
                        style={tabName === 'ActiveConnections' ? buttonStyles.tabActive : buttonStyles.tab}
                    >
                        <Text style={buttonStyles.tabText}>
                            {translate('components.activeConnections.title')}
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => this.handleButtonPress('Contacts')}
                        style={tabName === 'Contacts' ? buttonStyles.tabActive : buttonStyles.tab}
                    >
                        <Text style={buttonStyles.tabText}>
                            {translate('components.contactsSearch.title')}
                        </Text>
                    </Pressable>
                </>
            </FlatListHeaderTabs>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(MessagesContactsTab);
