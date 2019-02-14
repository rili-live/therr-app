exports.id = "server-client";
exports.modules = {

/***/ "./src/components/layout.tsx":
/*!***********************************!*\
  !*** ./src/components/layout.tsx ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const React = __webpack_require__(/*! react */ "react");
const redux_1 = __webpack_require__(/*! redux */ "redux");
const react_redux_1 = __webpack_require__(/*! react-redux */ "react-redux");
const react_router_dom_1 = __webpack_require__(/*! react-router-dom */ "react-router-dom");
const react_transition_group_1 = __webpack_require__(/*! react-transition-group */ "react-transition-group");
// import * as ReactGA from 'react-ga';
// import TopNav from './pieces/TopNav';
// import { configureAuthRoute } from '../library/authentication';
const redirect_with_status_1 = __webpack_require__(/*! rili-public-library/react-components/redirect-with-status */ "../rili-public-library/react-components/lib/redirect-with-status.js");
// import { Alerts } from '../library/alerts'
// import { Loader } from '../library/loader';
const scroll_to_1 = __webpack_require__(/*! rili-public-library/utilities/scroll-to */ "../rili-public-library/utilities/lib/scroll-to.js");
const interceptors_1 = __webpack_require__(/*! ../interceptors */ "./src/interceptors.ts");
// import roleConfig from '../../roleConfig';
const globalConfig = __webpack_require__(/*! ../../../global-config.js */ "../global-config.js");
// const AuthRoute = configureAuthRoute(roleConfig);
const routes_1 = __webpack_require__(/*! ../routes */ "./src/routes/index.ts");
let _viewListener;
const mapStateToProps = (state) => {
    return {
        'redirectRoute': state.redirectRoute
    };
};
const mapDispatchToProps = (dispatch) => {
    return redux_1.bindActionCreators({}, dispatch);
};
// interface ILayoutState {
// }
// TODO: Animation between view change is not working when wrapped around a Switch
class Layout extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            'clientHasLoaded': false
        };
        this.onViewChange = this.onViewChange.bind(this);
    }
    componentWillMount() {
        // TODO: Check if this should be initialized in index with history passed as argument
        // Initialize global interceptors such as 401, 403
        interceptors_1.default(this.props.history, globalConfig.baseApiRoute, 300);
        _viewListener = this.props.history.listen((location, action) => {
            this.onViewChange(location);
        });
    }
    componentDidMount() {
        // ReactGA.initialize(globalConfig[process.env.NODE_ENV].googleAnalyticsKey);
        this.setState({
            'clientHasLoaded': true
        });
    }
    onViewChange(location) {
        scroll_to_1.scrollTo(0, 100);
        // if (typeof(window) !== 'undefined') {
        //     ReactGA.set({ 'page': window.location.pathname });
        //     ReactGA.pageview(window.location.pathname);
        // }
    }
    render() {
        // Cloak the view so it doesn't flash before client mounts
        if (this.state.clientHasLoaded) {
            return (React.createElement("div", null,
                React.createElement("header", null, "Header"),
                React.createElement(react_transition_group_1.TransitionGroup, { appear: true, enter: true, exit: true, timeout: 250, component: "div", className: "content-container view" },
                    React.createElement(react_router_dom_1.Switch, null,
                        routes_1.default.map((route, i) => {
                            if (route.access) {
                                return (React.createElement(react_router_dom_1.Route, Object.assign({ location: this.props.location, key: i }, route)));
                            }
                            else {
                                return (React.createElement(react_router_dom_1.Route, Object.assign({ location: this.props.location, key: i }, route)));
                            }
                        }),
                        React.createElement(redirect_with_status_1.RedirectWithStatus, { from: "/redirect", to: "/" }))),
                React.createElement("footer", null, "This is the footer.")));
        }
        else {
            // Opportunity to add a loader of graphical display
            return (React.createElement("div", null,
                React.createElement("header", null, "Header")));
        }
    }
    componentWillUnmount() {
        _viewListener();
    }
}
exports.default = react_router_dom_1.withRouter(react_redux_1.connect(mapStateToProps, mapDispatchToProps)(Layout));


/***/ }),

/***/ "./src/server-client.tsx":
/*!*******************************!*\
  !*** ./src/server-client.tsx ***!
  \*******************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(__dirname) {
Object.defineProperty(exports, "__esModule", { value: true });
const http = __webpack_require__(/*! http */ "http");
const https = __webpack_require__(/*! https */ "https");
const path = __webpack_require__(/*! path */ "path");
const express = __webpack_require__(/*! express */ "express");
const fs = __webpack_require__(/*! fs */ "fs");
if (!process.env.BROWSER) {
    global.window = {}; // Temporarily define window for server-side
}
const React = __webpack_require__(/*! react */ "react");
const ReactDOMServer = __webpack_require__(/*! react-dom/server */ "../node_modules/react-dom/server.js");
const react_router_dom_1 = __webpack_require__(/*! react-router-dom */ "react-router-dom");
const redux_1 = __webpack_require__(/*! redux */ "redux");
const react_redux_1 = __webpack_require__(/*! react-redux */ "react-redux");
const redux_thunk_1 = __webpack_require__(/*! redux-thunk */ "redux-thunk");
const print_logs_1 = __webpack_require__(/*! rili-public-library/utilities/print-logs */ "../rili-public-library/utilities/lib/print-logs.js"); // tslint:disable-line no-implicit-dependencies
const globalConfig = __webpack_require__(/*! ../../global-config.js */ "../global-config.js");
const routeConfig_1 = __webpack_require__(/*! ./routeConfig */ "./src/routeConfig.ts");
const reducers_1 = __webpack_require__(/*! ./reducers */ "./src/reducers/index.ts");
const layout_1 = __webpack_require__(/*! ./components/layout */ "./src/components/layout.tsx");
const routes_1 = __webpack_require__(/*! ./routes */ "./src/routes/index.ts");
// Initialize the server and configure support for handlebars templates
const createAppServer = () => {
    let app = express();
    let server;
    if (true) {
        server = http.createServer(app);
    }
    else {}
    return {
        app,
        server
    };
};
const { app, server } = createAppServer();
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
// Define the folder that will be used for static assets
app.use(express.static(path.join(__dirname + '/../build/static/')));
// Universal routing and rendering for SEO
for (let i in routeConfig_1.default) {
    let routePath = routeConfig_1.default[i].route;
    let routeView = routeConfig_1.default[i].view;
    let title = routeConfig_1.default[i].head.title;
    app.get(routePath, (req, res) => {
        let promises = [];
        const context = {};
        const initialState = {};
        const store = redux_1.createStore(reducers_1.default, initialState, redux_1.applyMiddleware(redux_thunk_1.default));
        routes_1.default.some((route) => {
            const match = react_router_dom_1.matchPath(req.url, route);
            if (match && route.fetchData) {
                const Comp = route.component.WrappedComponent;
                const initData = (Comp && route.fetchData) || (() => Promise.resolve());
                // fetchData calls a dispatch on the store updating the current state before render
                promises.push(initData(store));
            }
            return !!match;
        });
        Promise.all(promises).then(() => {
            const markup = ReactDOMServer.renderToString(React.createElement(react_redux_1.Provider, { store: store },
                React.createElement(react_router_dom_1.StaticRouter, { location: req.url, context: context },
                    React.createElement(layout_1.default, null))));
            // This gets the initial state created after all dispatches are called in fetchData
            Object.assign(initialState, store.getState());
            const state = JSON.stringify(initialState);
            if (context.url) {
                print_logs_1.default(true, 'SERVER_CLIENT', null, 'Somewhere a <Redirect> was rendered');
                res.writeHead(context.statusCode, {
                    'Location': context.url
                });
                res.end();
            }
            else {
                return res.render(routeView, { title, markup, state });
            }
        });
    });
}
// Start the server
const port = globalConfig["development"].clientPort;
server.listen(port, (err) => {
    if (err) {
        return console.error(err);
    }
    print_logs_1.default(true, 'SERVER_CLIENT', null, `Server running on port, ${port}, with process id ${process.pid}`);
});

/* WEBPACK VAR INJECTION */}.call(this, "src"))

/***/ })

};
//# sourceMappingURL=server-client.553516b3369d8e98711d.hot-update.js.map