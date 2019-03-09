webpackHotUpdate("app",{

/***/ "./src/routes/home.tsx":
/*!*****************************!*\
  !*** ./src/routes/home.tsx ***!
  \*****************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const socket_1 = __webpack_require__(/*! actions/socket */ "./src/redux/actions/socket.ts");
const React = __webpack_require__(/*! react */ "../node_modules/react/index.js");
const react_redux_1 = __webpack_require__(/*! react-redux */ "../node_modules/react-redux/es/index.js");
const redux_1 = __webpack_require__(/*! redux */ "../node_modules/redux/es/redux.js");
const react_router_dom_1 = __webpack_require__(/*! react-router-dom */ "../node_modules/react-router-dom/es/index.js");
const input_1 = __webpack_require__(/*! rili-public-library/react-components/input */ "../rili-public-library/react-components/lib/input.js");
const button_secondary_1 = __webpack_require__(/*! rili-public-library/react-components/button-secondary */ "../rili-public-library/react-components/lib/button-secondary.js");
const translator_1 = __webpack_require__(/*! ../services/translator */ "./src/services/translator.ts");
// Environment Variables
// const envVars = globalConfig[process.env.NODE_ENV];
const mapStateToProps = (state) => {
    return {
        socket: state.socket,
    };
};
const mapDispatchToProps = (dispatch) => {
    return redux_1.bindActionCreators({
        joinRoom: socket_1.default.joinRoom,
    }, dispatch);
};
// const handleSessionUpdate = (message: any) => {
//     console.log('SESSION_UPDATE:', message); // tslint:disable-line no-console
// };
/**
 * Home
 */
class HomeComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasJoinedARoom: false,
            inputs: {
                roomId: 'general-chat'
            },
            roomsList: [],
        };
        // this.sessionToken = '';
        this.translate = (key, params) => translator_1.default('en-us', key, params);
        this.onInputChange = this.onInputChange.bind(this);
        this.onButtonClick = this.onButtonClick.bind(this);
        this.shouldDisableInput = this.shouldDisableInput.bind(this);
    }
    componentDidMount() {
        document.title = 'Rili | Home';
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
                    this.props.joinRoom({
                        roomId: this.state.inputs.roomId,
                        userName: this.state.inputs.userName
                    });
                    this.props.history.push('/chat-room');
                }
        }
    }
    shouldDisableInput(buttonName) {
        switch (buttonName) {
            case 'room':
                return !this.state.inputs.roomId || !this.state.inputs.userName;
        }
    }
    render() {
        const { socket } = this.props;
        return (React.createElement("div", null,
            React.createElement("hr", null),
            React.createElement("label", { htmlFor: "user_name" }, "Username:"),
            React.createElement(input_1.default, { type: "text", id: "user_name", name: "userName", onChange: this.onInputChange, onEnter: this.onButtonClick, translate: this.translate }),
            React.createElement("label", { htmlFor: "room_name" }, "Room:"),
            React.createElement(input_1.default, { type: "text", id: "room_name", name: "roomId", value: this.state.inputs.roomId, onChange: this.onInputChange, onEnter: this.onButtonClick, translate: this.translate }),
            socket && socket.rooms &&
                React.createElement("span", { id: "rooms_list" }, socket.rooms.length < 1
                    ? React.createElement("i", null, "No rooms are currently active. Click 'Join Room' to start a new one.")
                    : React.createElement("span", null,
                        "Active Rooms: ",
                        React.createElement("i", null, socket.rooms.map(room => `${room.roomKey}, `).toString()))),
            React.createElement("br", null),
            React.createElement("div", { className: "form-field" },
                React.createElement(button_secondary_1.default, { id: "join_room", text: "Join Room", onClick: this.onButtonClick, disabled: this.shouldDisableInput('room') }))));
    }
}
exports.HomeComponent = HomeComponent;
exports.default = react_router_dom_1.withRouter(react_redux_1.connect(mapStateToProps, mapDispatchToProps)(HomeComponent));


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
//# sourceMappingURL=app.79b9cbf9852453ec8665.hot-update.js.map