import React from 'react';
import { Pressable, Text } from 'react-native';
import { connect } from 'react-redux';
import 'react-native-gesture-handler';
import { FlatListHeaderTabs, mapStateToProps, mapDispatchToProps } from './';
import buttonStyles from '../../styles/navigation/buttonMenu';

class MessagesContactsTab extends FlatListHeaderTabs {
    constructor(props) {
        super(props);

        this.state = {
            activeTab: props.tabName,
        };
    }

    handleButtonPress = (name: string) => {
        const { onButtonPress } = this.props;

        this.navTo(name);

        this.setState({
            activeTab: name,
        });

        onButtonPress && onButtonPress(name);
    };

    isActive = (viewNames: string[]) => {
        const { activeTab } = this.state;
        // const currentScreen = this.getCurrentScreen();

        return viewNames.includes(activeTab);
    }

    render() {
        const { translate } = this.props;

        return (
            <FlatListHeaderTabs {...this.props}>
                <>
                    <Pressable
                        onPress={() => this.handleButtonPress('ActiveConnections')}
                        style={this.isActive(['ActiveConnections', 'CreateConnections']) ? buttonStyles.tabActive : buttonStyles.tab}
                    >
                        <Text style={buttonStyles.tabText}>
                            {translate('components.activeConnections.title')}
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => this.handleButtonPress('Contacts')}
                        style={this.isActive(['Contacts']) ? buttonStyles.tabActive : buttonStyles.tab}
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
