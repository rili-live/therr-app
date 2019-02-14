webpackHotUpdate("app",{

/***/ "./src/components/layout.tsx":
/*!***********************************!*\
  !*** ./src/components/layout.tsx ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const React = __webpack_require__(/*! react */ "../node_modules/react/index.js");
const redux_1 = __webpack_require__(/*! redux */ "../node_modules/redux/es/redux.js");
const react_redux_1 = __webpack_require__(/*! react-redux */ "../node_modules/react-redux/es/index.js");
const react_router_dom_1 = __webpack_require__(/*! react-router-dom */ "../node_modules/react-router-dom/es/index.js");
const react_transition_group_1 = __webpack_require__(/*! react-transition-group */ "../node_modules/react-transition-group/index.js");
// import * as ReactGA from 'react-ga';
// import TopNav from './pieces/TopNav';
// import { configureAuthRoute } from '../library/authentication';
const redirect_with_status_1 = __webpack_require__(/*! rili-public-library/react-components/redirect-with-status */ "../rili-public-library/react-components/lib/redirect-with-status.js"); // tslint:disable-line no-implicit-dependencies
// import { Alerts } from '../library/alerts'
// import { Loader } from '../library/loader';
const scroll_to_1 = __webpack_require__(/*! rili-public-library/utilities/scroll-to */ "../rili-public-library/utilities/lib/scroll-to.js"); // tslint:disable-line no-implicit-dependencies
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

/***/ "./src/routes/index.ts":
/*!*****************************!*\
  !*** ./src/routes/index.ts ***!
  \*****************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const chat_room_1 = __webpack_require__(/*! ./chat-room */ "./src/routes/chat-room.tsx");
const home_1 = __webpack_require__(/*! ./home */ "./src/routes/home.tsx");
const page_not_found_1 = __webpack_require__(/*! ./page-not-found */ "./src/routes/page-not-found.tsx");
let routes = [
    {
        path: '/',
        component: home_1.default,
        exact: true
    },
    {
        path: '/chat-room',
        component: chat_room_1.default,
        exact: true
    },
    // {
    // 	'path': '/login',
    // 	'component': Login,
    // 	'exact': true
    // },
    // {
    // 	'path': '/register',
    // 	'component': Register,
    // 	'exact': true
    // },
    // If no route matches, return NotFound component
    {
        'component': page_not_found_1.default
    }
];
exports.default = routes;


/***/ })

})
//# sourceMappingURL=app.0280d7a90e92fa034ec4.hot-update.js.map