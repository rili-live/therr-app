import React from 'react';
import { connect } from 'react-redux';
import { IUserState } from 'therr-react/types';

interface IActivitySchedulerProps {
    navigation: any;
    user: IUserState;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

/**
 * ActivityScheduler is now a thin redirect to ActivityGenerator,
 * which contains the full merged flow. Kept for backward compatibility
 * with deep links and existing navigation references.
 */
export class ActivityScheduler extends React.Component<IActivitySchedulerProps> {
    componentDidMount() {
        this.props.navigation.replace('ActivityGenerator');
    }

    render() {
        return null;
    }
}

export default connect(mapStateToProps)(ActivityScheduler);
