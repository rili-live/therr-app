import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import translator from '../services/translator';
import withNavigation from '../wrappers/withNavigation';
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
    private translate: Function;

    constructor(props: ITemplateProps) {
        super(props);

        this.state = {};

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = `Therr | ${this.translate('pages.template.helloTemplate')}`;
    }

    public render(): JSX.Element | null {
        return (
            <div id="page_template">
                {this.translate('pages.template.helloTemplate')}
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(TemplateComponent));
