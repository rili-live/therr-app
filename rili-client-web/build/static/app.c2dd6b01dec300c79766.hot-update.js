webpackHotUpdate("app",{

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


/***/ }),

/***/ "./src/routes/page-not-found.tsx":
/*!***************************************!*\
  !*** ./src/routes/page-not-found.tsx ***!
  \***************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const React = __webpack_require__(/*! react */ "../node_modules/react/index.js");
const react_router_dom_1 = __webpack_require__(/*! react-router-dom */ "../node_modules/react-router-dom/es/index.js");
const redirect_with_status_1 = __webpack_require__(/*! rili-public-library/react-components/redirect-with-status */ "../rili-public-library/react-components/lib/redirect-with-status.js");
const translator_1 = __webpack_require__(/*! ../services/translator */ "./src/services/translator.ts");
const globalConfig = __webpack_require__(/*! ../../../global-config.js */ "../global-config.js");
// Environment Variables
const envVars = globalConfig["development"];
/**
 * PageNotFound
 */
class PageNotFoundComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
        this.translate = (key, params) => translator_1.default('en-us', key, params);
    }
    componentDidMount() {
        document.title = 'Rili | Page Not Found';
    }
    render() {
        console.log(this.props);
        return (React.createElement(redirect_with_status_1.default, Object.assign({ statusCode: 404 }, this.props),
            React.createElement("div", null,
                React.createElement("h1", null, "404 | Page not found"))));
    }
}
exports.PageNotFoundComponent = PageNotFoundComponent;
exports.default = react_router_dom_1.withRouter(PageNotFoundComponent);


/***/ })

})
//# sourceMappingURL=app.c2dd6b01dec300c79766.hot-update.js.map