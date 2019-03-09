(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else {
		var a = factory();
		for(var i in a) (typeof exports === 'object' ? exports : root)[i] = a[i];
	}
})(global, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "/";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/server-socket-io.ts");
/******/ })
/************************************************************************/
/******/ ({

/***/ "../global-config.js":
/*!***************************!*\
  !*** ../global-config.js ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports) {

const apiPort = 7770;
const socketPortDev = 7771;
const socketPortProd = 7743;

module.exports = {
    development: {
        apiPort,
        baseApiRoute: `http://localhost:${apiPort}/api/`,
        baseSocketUrl: `http://localhost:${socketPortDev}`,
        clientPort: 7070,
        googleAnalyticsKey: '',
        redisHost: '127.0.0.1',
        redisPubPort: 17771,
        redisSubPort: 17772,
        socketPort: socketPortDev,
        security: {
            certLocation: '/etc/letsencrypt/live/rili.live/fullchain.pem',
            keyLocation: '/etc/letsencrypt/live/rili.live/privkey.pem',
        },
        socket: {
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 60,
        },
    },
    production: {
        apiPort,
        baseApiRoute: `http://rili.live:${apiPort}/api/`,
        baseSocketUrl: `https://rili.live:${socketPortProd}`,
        clientPort: 7070,
        googleAnalyticsKey: '',
        redisHost: '127.0.0.1',
        redisPubPort: 17771,
        redisSubPort: 17772,
        socketPort: socketPortProd,
        security: {
            certLocation: '/etc/letsencrypt/live/rili.live/fullchain.pem',
            keyLocation: '/etc/letsencrypt/live/rili.live/privkey.pem',
        },
        socket: {
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 60,
        },
    },
};


/***/ }),

/***/ "../rili-public-library/utilities/lib/constants.js":
/*!*********************************************************!*\
  !*** ../rili-public-library/utilities/lib/constants.js ***!
  \*********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

!function(e,t){ true?module.exports=t():undefined}(global,function(){return function(e){var t={};function n(r){if(t[r])return t[r].exports;var o=t[r]={i:r,l:!1,exports:{}};return e[r].call(o.exports,o,o.exports,n),o.l=!0,o.exports}return n.m=e,n.c=t,n.d=function(e,t,r){n.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:r})},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n.t=function(e,t){if(1&t&&(e=n(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var r=Object.create(null);if(n.r(r),Object.defineProperty(r,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)n.d(r,o,function(t){return e[t]}.bind(null,o));return r},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="/",n(n.s="jxKE")}({"0sdN":function(e,t,n){"use strict";var r;Object.defineProperty(t,"__esModule",{value:!0}),function(e){e.JOIN_ROOM="CLIENT:JOIN_ROOM",e.SEND_MESSAGE="CLIENT:SEND_MESSAGE"}(r||(r={})),t.default=r},jxKE:function(e,t,n){"use strict";Object.defineProperty(t,"__esModule",{value:!0});const r=n("0sdN");t.SocketClientActionTypes=r.default;const o=n("nwmR");t.SocketServerActionTypes=o.default,t.SERVER_PREFIX="SERVER",t.WEB_CLIENT_PREFIX="CLIENT"},nwmR:function(e,t,n){"use strict";var r;Object.defineProperty(t,"__esModule",{value:!0}),function(e){e.DISCONNECT="SERVER:DISCONNECT",e.JOINED_ROOM="SERVER:JOINED_ROOM",e.SEND_ROOMS_LIST="SERVER:SEND_ROOMS_LIST",e.SEND_MESSAGE="SERVER:SEND_MESSAGE",e.SESSION_MESSAGE="SERVER:SESSION_MESSAGE"}(r||(r={})),t.default=r}})});

/***/ }),

/***/ "../rili-public-library/utilities/lib/print-logs.js":
/*!**********************************************************!*\
  !*** ../rili-public-library/utilities/lib/print-logs.js ***!
  \**********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

!function(e,t){ true?module.exports=t():undefined}(global,function(){return function(e){var t={};function n(o){if(t[o])return t[o].exports;var r=t[o]={i:o,l:!1,exports:{}};return e[o].call(r.exports,r,r.exports,n),r.l=!0,r.exports}return n.m=e,n.c=t,n.d=function(e,t,o){n.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:o})},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n.t=function(e,t){if(1&t&&(e=n(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var o=Object.create(null);if(n.r(o),Object.defineProperty(o,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var r in e)n.d(o,r,function(t){return e[t]}.bind(null,r));return o},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="/",n(n.s="Sxyf")}({Sxyf:function(e,t,n){"use strict";Object.defineProperty(t,"__esModule",{value:!0});t.default=((e,t,n,...o)=>{if(e){const e=0!==n?`<at:${n||Date.now()}>`:"";for(let n=0;n<o.length;n++)t?console.info(`${t}${e}:`,o[n]):console.info(`LOG${e}:`,o[n])}})}})});

/***/ }),

/***/ "../rili-public-library/utilities/lib/promiser.js":
/*!********************************************************!*\
  !*** ../rili-public-library/utilities/lib/promiser.js ***!
  \********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

!function(e,t){ true?module.exports=t():undefined}(global,function(){return function(e){var t={};function r(n){if(t[n])return t[n].exports;var o=t[n]={i:n,l:!1,exports:{}};return e[n].call(o.exports,o,o.exports,r),o.l=!0,o.exports}return r.m=e,r.c=t,r.d=function(e,t,n){r.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:n})},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},r.t=function(e,t){if(1&t&&(e=r(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)r.d(n,o,function(t){return e[t]}.bind(null,o));return n},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,"a",t),t},r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.p="/",r(r.s="XDo8")}({XDo8:function(e,t,r){"use strict";Object.defineProperty(t,"__esModule",{value:!0});t.default=((e,t)=>(r,n)=>{r&&t(r),e(n)})}})});

/***/ }),

/***/ "./src/constants/index.ts":
/*!********************************!*\
  !*** ./src/constants/index.ts ***!
  \********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const disconnect_reason_1 = __webpack_require__(/*! ./socket/disconnect-reason */ "./src/constants/socket/disconnect-reason.ts");
exports.SocketDisconnectReason = disconnect_reason_1.default;
exports.ACTION = 'action';


/***/ }),

/***/ "./src/constants/socket/disconnect-reason.ts":
/*!***************************************************!*\
  !*** ./src/constants/socket/disconnect-reason.ts ***!
  \***************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
var DisconnectReason;
(function (DisconnectReason) {
    DisconnectReason["transportClose"] = "transport close";
    DisconnectReason["pingTimeout"] = "ping timeout";
})(DisconnectReason || (DisconnectReason = {}));
exports.default = DisconnectReason;


/***/ }),

/***/ "./src/handlers/socket/index.ts":
/*!**************************************!*\
  !*** ./src/handlers/socket/index.ts ***!
  \**************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const join_room_1 = __webpack_require__(/*! ./join-room */ "./src/handlers/socket/join-room.ts");
exports.joinRoom = join_room_1.default;
const send_message_1 = __webpack_require__(/*! ./send-message */ "./src/handlers/socket/send-message.ts");
exports.sendMessage = send_message_1.default;


/***/ }),

/***/ "./src/handlers/socket/join-room.ts":
/*!******************************************!*\
  !*** ./src/handlers/socket/join-room.ts ***!
  \******************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const print_logs_1 = __webpack_require__(/*! rili-public-library/utilities/print-logs */ "../rili-public-library/utilities/lib/print-logs.js"); // tslint:disable-line no-implicit-dependencies
const constants_1 = __webpack_require__(/*! rili-public-library/utilities/constants */ "../rili-public-library/utilities/lib/constants.js");
const Constants = __webpack_require__(/*! ../../constants */ "./src/constants/index.ts");
const server_socket_io_1 = __webpack_require__(/*! ../../server-socket-io */ "./src/server-socket-io.ts");
const joinRoom = (socket, redisSession, data) => {
    // Leave all current rooms (except default room) before joining a new one
    Object.keys(socket.rooms)
        .filter((room) => room !== socket.id)
        .forEach((room) => {
        socket.broadcast.to(room).emit('event', `${data.userName} left the room`);
        socket.leave(room);
    });
    // TODO: RSERV-4: Determine why this setTimeout exists
    setTimeout(() => {
        socket.join(data.roomId, () => {
            // TODO: After adding user login, this should be created after login rather then after joining a room
            if (socket.handshake && socket.handshake.headers && socket.handshake.headers.host) {
                redisSession.create({
                    app: server_socket_io_1.rsAppName,
                    socketId: socket.id,
                    ip: socket.handshake.headers.host.split(':')[0],
                    // 30 minutes
                    ttl: 60 * 1000 * 30,
                    data: {
                        userName: data.userName,
                    },
                }).then((response) => {
                    socket.emit(Constants.ACTION, {
                        type: constants_1.SocketServerActionTypes.SESSION_MESSAGE,
                        data: response,
                    });
                }).catch((err) => {
                    print_logs_1.default(server_socket_io_1.shouldIncludeRedisLogs, 'REDIS_SESSION_ERROR', null, err);
                });
            }
            print_logs_1.default(server_socket_io_1.shouldIncludeSocketLogs, 'SOCKET_IO_LOGS', null, `User, ${data.userName} with socketId ${socket.id}, joined room ${data.roomId}`);
            print_logs_1.default(server_socket_io_1.shouldIncludeSocketLogs, 'SOCKET_IO_LOGS', null, `${data.userName}'s Current Rooms: ${JSON.stringify(socket.rooms)}`);
            // Emits an event back to the client who joined
            socket.emit(Constants.ACTION, {
                type: constants_1.SocketServerActionTypes.JOINED_ROOM,
                data: {
                    roomId: data.roomId,
                    message: `You joined room ${data.roomId}`,
                }
            });
            // Broadcasts an event back to the client for all users in the specified room (excluding the user who triggered it)
            socket.broadcast.to(data.roomId).emit(Constants.ACTION, {
                type: constants_1.SocketServerActionTypes.JOINED_ROOM,
                data: {
                    roomId: data.roomId,
                    message: `${data.userName} joined room ${data.roomId}`,
                },
            });
        });
    }, 0);
};
exports.default = joinRoom;


/***/ }),

/***/ "./src/handlers/socket/send-message.ts":
/*!*********************************************!*\
  !*** ./src/handlers/socket/send-message.ts ***!
  \*********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const print_logs_1 = __webpack_require__(/*! rili-public-library/utilities/print-logs */ "../rili-public-library/utilities/lib/print-logs.js"); // tslint:disable-line no-implicit-dependencies
const constants_1 = __webpack_require__(/*! rili-public-library/utilities/constants */ "../rili-public-library/utilities/lib/constants.js");
const Constants = __webpack_require__(/*! ../../constants */ "./src/constants/index.ts");
const server_socket_io_1 = __webpack_require__(/*! ../../server-socket-io */ "./src/server-socket-io.ts");
const sendMessage = (socket, data) => {
    print_logs_1.default(server_socket_io_1.shouldIncludeLogs, constants_1.SocketClientActionTypes.SEND_MESSAGE, null, data);
    socket.emit('action', {
        type: constants_1.SocketServerActionTypes.SEND_MESSAGE,
        data: `You: ${data.message}`,
        roomId: data.roomId,
    });
    socket.broadcast.to(data.roomName).emit(Constants.ACTION, {
        type: constants_1.SocketServerActionTypes.SEND_MESSAGE,
        data: `${data.userName}: ${data.message}`,
        roomId: data.roomId,
    });
    print_logs_1.default(server_socket_io_1.shouldIncludeSocketLogs, 'SOCKET_IO_LOGS', null, `${data.userName} said: ${data.message}`);
};
exports.default = sendMessage;


/***/ }),

/***/ "./src/server-socket-io.ts":
/*!*********************************!*\
  !*** ./src/server-socket-io.ts ***!
  \*********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const express = __webpack_require__(/*! express */ "express");
const fs = __webpack_require__(/*! fs */ "fs");
const http = __webpack_require__(/*! http */ "http");
const https = __webpack_require__(/*! https */ "https");
const Redis = __webpack_require__(/*! ioredis */ "ioredis");
const socketio = __webpack_require__(/*! socket.io */ "socket.io");
const socketioRedis = __webpack_require__(/*! socket.io-redis */ "socket.io-redis");
const socketHandlers = __webpack_require__(/*! ./handlers/socket */ "./src/handlers/socket/index.ts");
const constants_1 = __webpack_require__(/*! rili-public-library/utilities/constants */ "../rili-public-library/utilities/lib/constants.js");
const Constants = __webpack_require__(/*! ./constants */ "./src/constants/index.ts");
const print_logs_1 = __webpack_require__(/*! rili-public-library/utilities/print-logs */ "../rili-public-library/utilities/lib/print-logs.js");
const globalConfig = __webpack_require__(/*! ../../global-config.js */ "../global-config.js");
const redis_session_1 = __webpack_require__(/*! ./services/redis-session */ "./src/services/redis-session.ts");
const get_socket_rooms_list_1 = __webpack_require__(/*! ./utilities/get-socket-rooms-list */ "./src/utilities/get-socket-rooms-list.ts");
exports.rsAppName = 'riliChat';
// Session to attach socket.io details to username while logged in
exports.shouldIncludeAllLogs = process.argv[2] === 'withAllLogs';
exports.shouldIncludeLogs = process.argv[2] === 'withLogs';
exports.shouldIncludeRedisLogs = process.argv[2] === 'withRedisLogs'
    || exports.shouldIncludeAllLogs;
exports.shouldIncludeSocketLogs = process.argv[2] === 'withSocketLogs'
    || exports.shouldIncludeAllLogs
    || exports.shouldIncludeRedisLogs;
const nodes = [
    // Pub
    {
        host: globalConfig["development"].redisHost,
        port: globalConfig["development"].redisPubPort
    },
    // Sub
    {
        host: globalConfig["development"].redisHost,
        port: globalConfig["development"].redisSubPort
    },
];
// TODO: RSERV-6: Configure redis clusters
// NOTE: Redis cluster only works on Docker for Linux (ie. Ubuntu) using the host network (https://docs.docker.com/network/host/)
// const redisPubCluster = new Redis.Cluster(nodes);
// const redisSubCluster = new Redis.Cluster(nodes);
const redisPub = new Redis(nodes[0].port, nodes[0].host, {
    connectionName: 'redisSocketPub',
    lazyConnect: true,
});
const redisSession = new redis_session_1.default({
    client: redisPub,
});
// TODO: RSERV-5: PubSub doesn't seem to work when on different ports
// This might simply require redis clusters
const redisSub = new Redis(nodes[0].port, nodes[0].host, {
    connectionName: 'redisSocketSub',
    lazyConnect: true,
});
// We must connect manually since lazyConnect is true
const redisConnectPromises = [redisPub.connect(), redisSub.connect()];
Promise.all(redisConnectPromises).then((responses) => {
    // connection ready
    if (exports.shouldIncludeRedisLogs) {
        redisPub.monitor().then(function (monitor) {
            monitor.on('monitor', function (time, args, source, database) {
                print_logs_1.default(true, `REDIS_PUB_LOG`, time, `Source: ${source}, Database: ${database}`, ...args);
            });
        });
    }
    // Wait for both pub and sub redis instances to connect before starting Express/Socket.io server
    startExpressSocketIOServer();
});
const startExpressSocketIOServer = () => {
    let app = express();
    let httpsServer;
    if (true) {
        httpsServer = http.createServer(app);
    }
    else {}
    let server = httpsServer.listen(globalConfig["development"].socketPort, (err) => {
        const port = globalConfig["development"].socketPort;
        print_logs_1.default(true, 'SOCKET_IO_LOGS', null, `Server running on port, ${port}, with process id ${process.pid}`);
    });
    // NOTE: engine.io config options https://github.com/socketio/engine.io#methods-1
    let io = socketio(server, {
        // how many ms before sending a new ping packet
        pingInterval: globalConfig["development"].socket.pingInterval,
        // how many ms without a pong packet to consider the connection closed
        pingTimeout: globalConfig["development"].socket.pingTimeout,
    });
    const redisAdapter = socketioRedis({
        pubClient: redisPub,
        subClient: redisSub,
    });
    io.adapter(redisAdapter);
    // Redis Error handling
    // redisPubCluster.on('error', (error: string) => {
    //     printLogs(shouldIncludeRedisLogs, 'REDIS_PUB_CLUSTER_CONNECTION_ERROR:', null, error);
    // });
    // redisSubCluster.on('error', (error: string) => {
    //     printLogs(shouldIncludeRedisLogs, 'REDIS_SUB_CLUSTER_CONNECTION_ERROR:', null, error);
    // });
    redisAdapter.pubClient.on('error', (err) => {
        print_logs_1.default(exports.shouldIncludeRedisLogs, 'REDIS_PUB_CLIENT_ERROR', null, err);
    });
    redisAdapter.subClient.on('error', (err) => {
        print_logs_1.default(exports.shouldIncludeRedisLogs, 'REDIS_SUB_CLIENT_ERROR', null, err);
    });
    redisAdapter.subClient.on('subscribe', (channel, count) => {
        print_logs_1.default(exports.shouldIncludeRedisLogs, 'REDIS_SUB_CLIENT', null, `Subscribed to ${channel}. Now subscribed to ${count} channel(s).`);
    });
    redisAdapter.subClient.on('message', (channel, message) => {
        print_logs_1.default(exports.shouldIncludeRedisLogs, 'REDIS_SUB_CLIENT', null, `Message from channel ${channel}: ${message}`);
    });
    io.on('connection', (socket) => {
        print_logs_1.default(exports.shouldIncludeSocketLogs, 'SOCKET_IO_LOGS', null, 'NEW CONNECTION...');
        print_logs_1.default(exports.shouldIncludeSocketLogs, 'SOCKET_IO_LOGS', null, `All Rooms: ${JSON.stringify(get_socket_rooms_list_1.default(io.sockets.adapter.rooms))}`);
        // Send a list of the currently active chat rooms when user connects
        socket.emit(Constants.ACTION, {
            type: constants_1.SocketServerActionTypes.SEND_ROOMS_LIST,
            data: get_socket_rooms_list_1.default(io.sockets.adapter.rooms)
        });
        // Event sent from socket.io, redux store middleware
        socket.on(Constants.ACTION, (action) => {
            if (action.type === constants_1.SocketClientActionTypes.JOIN_ROOM) {
                socketHandlers.joinRoom(socket, redisSession, action.data);
            }
            if (action.type === constants_1.SocketClientActionTypes.SEND_MESSAGE) {
                socketHandlers.sendMessage(socket, action.data);
            }
        });
        socket.on('disconnecting', (reason) => {
            // TODO: Use constants to mitigate disconnect reasons
            print_logs_1.default(exports.shouldIncludeSocketLogs, 'SOCKET_IO_LOGS', null, `DISCONNECTING... ${reason}`);
            leaveAndNotifyRooms(socket);
        });
    });
};
const leaveAndNotifyRooms = (socket) => {
    const activeRooms = Object.keys(socket.rooms)
        .filter((room) => room !== socket.id);
    if (activeRooms.length) {
        redisSession.get(socket.id).then((response) => {
            activeRooms.forEach((room) => {
                const parsedResponse = JSON.parse(response);
                if (parsedResponse && parsedResponse.userName) {
                    socket.broadcast.to(room).emit('event', {
                        type: constants_1.SocketServerActionTypes.DISCONNECT,
                        data: `${parsedResponse.userName} left the room`,
                    });
                }
            });
        }).catch((err) => {
            print_logs_1.default(exports.shouldIncludeRedisLogs, 'REDIS_SESSION_ERROR', null, err);
        });
    }
};


/***/ }),

/***/ "./src/services/redis-helper.ts":
/*!**************************************!*\
  !*** ./src/services/redis-helper.ts ***!
  \**************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const promiser_1 = __webpack_require__(/*! rili-public-library/utilities/promiser */ "../rili-public-library/utilities/lib/promiser.js");
const globalConfig = __webpack_require__(/*! ../../../global-config.js */ "../global-config.js");
/**
 * RedisHelper
 * redisClient: any - the ioredis client to enter redis commands
 */
class RedisHelper {
    constructor(redisClient) {
        this.storeUser = (userSocketConfig) => {
            return new Promise((resolve, reject) => {
                this.client.setex(userSocketConfig.socketId, userSocketConfig.ttl || globalConfig["development"].socket.userSocketSessionExpire, userSocketConfig.data, promiser_1.default(resolve, reject));
            });
        };
        this.getUser = (socketId) => {
            return new Promise((resolve, reject) => {
                this.client.get(socketId, promiser_1.default(resolve, reject));
            });
        };
        // NOTE: client should be build from ioredis
        this.client = redisClient;
    }
}
exports.default = RedisHelper;


/***/ }),

/***/ "./src/services/redis-session.ts":
/*!***************************************!*\
  !*** ./src/services/redis-session.ts ***!
  \***************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const globalConfig = __webpack_require__(/*! ../../../global-config.js */ "../global-config.js");
const redis_helper_1 = __webpack_require__(/*! ./redis-helper */ "./src/services/redis-helper.ts");
/**
 * RedisSession
 * redisClient: any - the client to enter redis commands
 */
class RedisSession {
    constructor(args) {
        this.client = args.client;
        this.redisHelper = new redis_helper_1.default(this.client);
    }
    create(args) {
        const configuredArgs = Object.assign({}, {
            // TODO: RSERV-4: Use app and ip to namespace
            // TODO: RSERV-4: Create a token to send back to the frontend
            app: args.app,
            socketId: args.socketId,
            ip: args.ip.toString(),
            ttl: args.ttl || globalConfig["development"].socket.userSocketSessionExpire,
            data: JSON.stringify(args.data),
        });
        return this.redisHelper.storeUser(configuredArgs).then(() => {
            return configuredArgs;
        });
    }
    get(socketId) {
        return this.redisHelper.getUser(socketId);
    }
}
exports.default = RedisSession;


/***/ }),

/***/ "./src/utilities/get-socket-rooms-list.ts":
/*!************************************************!*\
  !*** ./src/utilities/get-socket-rooms-list.ts ***!
  \************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const getRoomsList = (rooms) => {
    const roomsArray = [];
    const roomKeys = Object.keys(rooms).filter((roomKey) => {
        return rooms[roomKey].length !== 1 || roomKey !== Object.keys(rooms[roomKey].sockets)[0];
    });
    roomKeys.forEach((roomKey) => roomsArray.push({
        roomKey,
        length: rooms[roomKey].length,
        sockets: Object.keys(rooms[roomKey].sockets).map((socketId) => ({
            socketId,
            active: rooms[roomKey].sockets[socketId],
        }))
    }));
    return roomsArray;
};
exports.default = getRoomsList;


/***/ }),

/***/ "express":
/*!**************************!*\
  !*** external "express" ***!
  \**************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("express");

/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("fs");

/***/ }),

/***/ "http":
/*!***********************!*\
  !*** external "http" ***!
  \***********************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("http");

/***/ }),

/***/ "https":
/*!************************!*\
  !*** external "https" ***!
  \************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("https");

/***/ }),

/***/ "ioredis":
/*!**************************!*\
  !*** external "ioredis" ***!
  \**************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("ioredis");

/***/ }),

/***/ "socket.io":
/*!****************************!*\
  !*** external "socket.io" ***!
  \****************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("socket.io");

/***/ }),

/***/ "socket.io-redis":
/*!**********************************!*\
  !*** external "socket.io-redis" ***!
  \**********************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("socket.io-redis");

/***/ })

/******/ });
});
//# sourceMappingURL=server-socket-io.js.map