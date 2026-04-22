import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';
// import * as globalConfig from '../../../global-config.js';

interface ITemplateRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface ITemplateDispatchProps {
}

interface IStoreProps extends ITemplateDispatchProps, ITemplateRouterProps {}

// Regular component props
interface ITemplateProps extends ITemplateRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
}

interface ITemplateState {
}

// Environment Variables
// const envVars = globalConfig[process.env.NODE_ENV];

const mapStateToProps = (state: any) => ({
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
}, dispatch);

/**
 * Template
 */
export class TemplateComponent extends React.Component<ITemplateProps, ITemplateState> {
    constructor(props: ITemplateProps) {
        super(props);

        this.state = {};
    }

    componentDidMount() {
        document.title = `Therr | ${this.props.translate('pages.template.helloTemplate')}`;
    }

    public render(): JSX.Element | null {
        return (
            <div id="page_template">
                {this.props.translate('pages.template.helloTemplate')}
            </div>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(TemplateComponent)));
