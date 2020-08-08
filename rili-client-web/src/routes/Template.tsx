import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import translator from '../services/translator';
// import * as globalConfig from '../../../global-config.js';

interface ITemplateRouterProps {
}

interface ITemplateDispatchProps {
}

type IStoreProps = ITemplateDispatchProps

// Regular component props
interface ITemplateProps extends RouteComponentProps<ITemplateRouterProps>, IStoreProps {
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

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = `Therr | ${this.translate('pages.template.helloTemplate')}`;
    }

    private translate: Function;

    public render(): JSX.Element | null {
        return (
            <div id="page_template">
                {this.translate('pages.template.helloTemplate')}
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(TemplateComponent));
