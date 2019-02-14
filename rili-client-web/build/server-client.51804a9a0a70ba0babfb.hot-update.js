exports.id = "server-client";
exports.modules = {

/***/ "./src/routeConfig.ts":
/*!****************************!*\
  !*** ./src/routeConfig.ts ***!
  \****************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.default = [
    {
        route: '/',
        head: {
            title: 'Home'
        },
        view: 'index'
    },
    {
        route: '/chat-room',
        head: {
            title: 'Chat Room'
        },
        view: 'index'
    },
    {
        route: '*',
        head: {
            title: 'Not Found'
        },
        view: 'index'
    }
];


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
                res.writeHead(context.status, {
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
//# sourceMappingURL=server-client.51804a9a0a70ba0babfb.hot-update.js.map