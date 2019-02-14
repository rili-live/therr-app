webpackHotUpdate("app",{

/***/ "../rili-public-library/react-components/lib/redirect-with-status.js":
/*!***************************************************************************!*\
  !*** ../rili-public-library/react-components/lib/redirect-with-status.js ***!
  \***************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(module) {var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

!function (e, t) {
  "object" == ( false ? undefined : _typeof(exports)) && "object" == ( false ? undefined : _typeof(module)) ? module.exports = t(__webpack_require__(/*! react */ "../node_modules/react/index.js"), __webpack_require__(/*! react-router-dom */ "../node_modules/react-router-dom/es/index.js")) :  true ? !(__WEBPACK_AMD_DEFINE_ARRAY__ = [__webpack_require__(/*! react */ "../node_modules/react/index.js"), __webpack_require__(/*! react-router-dom */ "../node_modules/react-router-dom/es/index.js")], __WEBPACK_AMD_DEFINE_FACTORY__ = (t),
				__WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
				(__WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__)) : __WEBPACK_AMD_DEFINE_FACTORY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)) : undefined;
}(window, function (e, t) {
  return function (e) {
    var t = {};function r(o) {
      if (t[o]) return t[o].exports;var n = t[o] = { i: o, l: !1, exports: {} };return e[o].call(n.exports, n, n.exports, r), n.l = !0, n.exports;
    }return r.m = e, r.c = t, r.d = function (e, t, o) {
      r.o(e, t) || Object.defineProperty(e, t, { enumerable: !0, get: o });
    }, r.r = function (e) {
      "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(e, "__esModule", { value: !0 });
    }, r.t = function (e, t) {
      if (1 & t && (e = r(e)), 8 & t) return e;if (4 & t && "object" == (typeof e === "undefined" ? "undefined" : _typeof(e)) && e && e.__esModule) return e;var o = Object.create(null);if (r.r(o), Object.defineProperty(o, "default", { enumerable: !0, value: e }), 2 & t && "string" != typeof e) for (var n in e) {
        r.d(o, n, function (t) {
          return e[t];
        }.bind(null, n));
      }return o;
    }, r.n = function (e) {
      var t = e && e.__esModule ? function () {
        return e.default;
      } : function () {
        return e;
      };return r.d(t, "a", t), t;
    }, r.o = function (e, t) {
      return Object.prototype.hasOwnProperty.call(e, t);
    }, r.p = "/", r(r.s = "USjJ");
  }({ USjJ: function USjJ(e, t, r) {
      "use strict";
      Object.defineProperty(t, "__esModule", { value: !0 });var o = r("cDcd"),
          n = r("oncg");t.default = function (_o$Component) {
        _inherits(_class, _o$Component);

        function _class(e) {
          _classCallCheck(this, _class);

          return _possibleConstructorReturn(this, (_class.__proto__ || Object.getPrototypeOf(_class)).call(this, e));
        }

        _createClass(_class, [{
          key: "render",
          value: function render() {
            console.log(this.props);var _props = this.props,
                e = _props.from,
                t = _props.statusCode,
                r = _props.to;
            return o.createElement(n.Route, { render: function render(_ref) {
                var u = _ref.staticContext;
                return u && (u.statusCode = t), o.createElement(n.Redirect, { from: e, to: r });
              } });
          }
        }]);

        return _class;
      }(o.Component);
    }, cDcd: function cDcd(t, r) {
      t.exports = e;
    }, oncg: function oncg(e, r) {
      e.exports = t;
    } });
});
//# sourceMappingURL=redirect-with-status.js.map
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../../../node_modules/webpack/buildin/module.js */ "../node_modules/webpack/buildin/module.js")(module)))

/***/ }),

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
        scroll_to_1.default(0, 100);
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

/***/ "./src/routes/chat-room.tsx":
/*!**********************************!*\
  !*** ./src/routes/chat-room.tsx ***!
  \**********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const React = __webpack_require__(/*! react */ "../node_modules/react/index.js");
const react_router_dom_1 = __webpack_require__(/*! react-router-dom */ "../node_modules/react-router-dom/es/index.js");
const io = __webpack_require__(/*! socket.io-client */ "../node_modules/socket.io-client/lib/index.js");
const input_1 = __webpack_require__(/*! rili-public-library/react-components/input */ "../rili-public-library/react-components/lib/input.js");
// import SelectBox from 'rili-public-library/react-components/select-box';
const button_secondary_1 = __webpack_require__(/*! rili-public-library/react-components/button-secondary */ "../rili-public-library/react-components/lib/button-secondary.js");
const scroll_to_1 = __webpack_require__(/*! rili-public-library/utilities/scroll-to */ "../rili-public-library/utilities/lib/scroll-to.js");
const translator_1 = __webpack_require__(/*! ../services/translator */ "./src/services/translator.ts");
const globalConfig = __webpack_require__(/*! ../../../global-config.js */ "../global-config.js");
// Environment Variables
const envVars = globalConfig["development"];
const addLi = (message) => {
    const listEl = document.getElementById('list');
    const li = document.createElement('li');
    li.appendChild(document.createTextNode(message));
    listEl.appendChild(li);
    scroll_to_1.default(listEl.scrollHeight, 200);
};
/**
 * ChatRoom
 */
class ChatRoomComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            inputs: {},
            selectedRoomKey: '',
        };
        this.messageInputRef = React.createRef();
        // this.sessionToken = '';
        this.socket = io(`${envVars.baseSocketUrl}`, {
            secure: true,
            transports: ['websocket'],
            upgrade: false
        });
        this.translate = (key, params) => translator_1.default('en-us', key, params);
        this.onInputChange = this.onInputChange.bind(this);
        this.onButtonClick = this.onButtonClick.bind(this);
        this.shouldDisableInput = this.shouldDisableInput.bind(this);
    }
    componentDidMount() {
        document.title = 'Rili | Chat Room';
        this.socket.on('event', addLi);
        this.socket.on('message', addLi);
    }
    onInputChange(name, value) {
        const newInputChanges = {
            [name]: value,
        };
        this.setState({
            inputs: Object.assign({}, this.state.inputs, newInputChanges)
        });
    }
    onButtonClick(event) {
        switch (event.target.id) {
            case 'enter_message':
            case 'message':
                this.socket.emit('event', {
                    roomName: this.state.inputs.roomName,
                    message: this.state.inputs.message,
                    userName: this.state.inputs.userName
                });
                return this.onInputChange('message', '');
        }
    }
    shouldDisableInput(buttonName) {
        switch (buttonName) {
            case 'sendMessage':
                return !this.state.inputs.message;
        }
    }
    render() {
        return (React.createElement("div", null,
            React.createElement("hr", null),
            React.createElement("div", { className: "form-field-wrapper inline" },
                React.createElement(input_1.default, { ref: this.messageInputRef, autoComplete: "off", type: "text", id: "message", name: "message", value: this.state.inputs.message, onChange: this.onInputChange, onEnter: this.onButtonClick, placeholder: "Enter a message", translate: this.translate }),
                React.createElement("div", { className: "form-field" },
                    React.createElement(button_secondary_1.default, { id: "enter_message", text: "Send", onClick: this.onButtonClick, disabled: this.shouldDisableInput('sendMessage') }))),
            React.createElement("div", { id: "roomTitle" },
                "Room Name: ",
                this.state.inputs.roomName),
            React.createElement("ul", { id: "list" })));
    }
}
exports.ChatRoomComponent = ChatRoomComponent;
exports.default = react_router_dom_1.withRouter(ChatRoomComponent);


/***/ }),

/***/ "./src/routes/home.tsx":
/*!*****************************!*\
  !*** ./src/routes/home.tsx ***!
  \*****************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const React = __webpack_require__(/*! react */ "../node_modules/react/index.js");
const react_router_dom_1 = __webpack_require__(/*! react-router-dom */ "../node_modules/react-router-dom/es/index.js");
const io = __webpack_require__(/*! socket.io-client */ "../node_modules/socket.io-client/lib/index.js");
const input_1 = __webpack_require__(/*! rili-public-library/react-components/input */ "../rili-public-library/react-components/lib/input.js");
// import SelectBox from 'rili-public-library/react-components/select-box';
const button_secondary_1 = __webpack_require__(/*! rili-public-library/react-components/button-secondary */ "../rili-public-library/react-components/lib/button-secondary.js");
const translator_1 = __webpack_require__(/*! ../services/translator */ "./src/services/translator.ts");
const globalConfig = __webpack_require__(/*! ../../../global-config.js */ "../global-config.js");
// Environment Variables
const envVars = globalConfig["development"];
const handleSessionUpdate = (message) => {
    console.log('SESSION_UPDATE:', message); // tslint:disable-line no-console
};
const updateRoomsList = (message) => {
    const roomsList = JSON.parse(message).map((room) => (room.roomKey));
    if (roomsList.length > 0) {
        document.getElementById('rooms_list').innerHTML = `Active Rooms: <i>${roomsList}</i>`;
    }
    else {
        document.getElementById('rooms_list').innerHTML = `<i>No rooms are currently active. Click 'Join Room' to start a new one.</i>`;
    }
};
/**
 * Home
 */
class HomeComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasJoinedARoom: false,
            inputs: {
                roomName: 'general-chat'
            },
            roomsList: [],
        };
        // this.sessionToken = '';
        this.socket = io(`${envVars.baseSocketUrl}`, {
            secure: true,
            transports: ['websocket'],
            upgrade: false
        });
        this.translate = (key, params) => translator_1.default('en-us', key, params);
        this.onInputChange = this.onInputChange.bind(this);
        this.onButtonClick = this.onButtonClick.bind(this);
        this.shouldDisableInput = this.shouldDisableInput.bind(this);
    }
    componentDidMount() {
        document.title = 'Rili | Home';
        this.socket.on('rooms:list', updateRoomsList);
        this.socket.on('session:message', handleSessionUpdate);
    }
    onInputChange(name, value) {
        const newInputChanges = {
            [name]: value,
        };
        this.setState({
            inputs: Object.assign({}, this.state.inputs, newInputChanges)
        });
    }
    onButtonClick(event) {
        switch (event.target.id) {
            case 'join_room':
            case 'room_name':
            case 'user_name':
                if (!this.shouldDisableInput('room')) {
                    this.socket.emit('room.join', {
                        roomName: this.state.inputs.roomName,
                        userName: this.state.inputs.userName
                    });
                    this.props.history.push('/chat-room');
                }
        }
    }
    shouldDisableInput(buttonName) {
        switch (buttonName) {
            case 'room':
                return !this.state.inputs.roomName || !this.state.inputs.userName;
            case 'sayHello':
                return !this.state.hasJoinedARoom || !this.state.inputs.userName;
            case 'sendMessage':
                return !this.state.hasJoinedARoom || !this.state.inputs.message;
        }
    }
    render() {
        return (React.createElement("div", null,
            React.createElement("hr", null),
            React.createElement("label", { htmlFor: "user_name" }, "Username:"),
            React.createElement(input_1.default, { type: "text", id: "user_name", name: "userName", onChange: this.onInputChange, onEnter: this.onButtonClick, translate: this.translate }),
            React.createElement("label", { htmlFor: "room_name" }, "Room:"),
            React.createElement(input_1.default, { type: "text", id: "room_name", name: "roomName", value: this.state.inputs.roomName, onChange: this.onInputChange, onEnter: this.onButtonClick, translate: this.translate }),
            React.createElement("span", { id: "rooms_list" }),
            React.createElement("br", null),
            React.createElement("div", { className: "form-field" },
                React.createElement(button_secondary_1.default, { id: "join_room", text: "Join Room", onClick: this.onButtonClick, disabled: this.shouldDisableInput('room') }))));
    }
}
exports.HomeComponent = HomeComponent;
exports.default = react_router_dom_1.withRouter(HomeComponent);


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
        return (React.createElement(redirect_with_status_1.default, Object.assign({ statusCode: 404 }, this.props),
            React.createElement("div", null,
                React.createElement("h1", null, "404 | Page not found"))));
    }
}
exports.PageNotFoundComponent = PageNotFoundComponent;
exports.default = react_router_dom_1.withRouter(PageNotFoundComponent);


/***/ })

})
//# sourceMappingURL=app.32a4296ce98044fa50d2.hot-update.js.map