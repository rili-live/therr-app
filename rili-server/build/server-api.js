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
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/server-api.ts");
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
const socketPortDev = 7743;
const socketPortProd = 7743;

module.exports = {
    development: {
        apiPort,
        baseApiRoute: `http://localhost:${apiPort}/api/`,
        baseUrl: `http://localhost:7771${socketPortDev}`,
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
        baseUrl: `https://rili.live:7743${socketPortProd}`,
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

/***/ "./src/server-api.ts":
/*!***************************!*\
  !*** ./src/server-api.ts ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const cluster = __webpack_require__(/*! cluster */ "cluster");
const express = __webpack_require__(/*! express */ "express");
const os = __webpack_require__(/*! os */ "os");
const path = __webpack_require__(/*! path */ "path");
const globalConfig = __webpack_require__(/*! ../../global-config.js */ "../global-config.js");
let app = express();
// Serves static files in the /build/static directory
app.use(express.static(path.join(__dirname, 'static')));
// Routes
app.get('/', (req, res) => {
    res.send('Hello, world!');
});
// Cluster config and server start
if (cluster.isMaster) {
    let numWorkers = os.cpus().length;
    console.log('Master cluster setting up ' + numWorkers + ' workers...'); // tslint:disable-line no-console
    for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
    }
    cluster.on('online', function (worker) {
        console.log('Worker ' + worker.process.pid + ' is online'); // tslint:disable-line no-console
    });
    cluster.on('exit', function (worker, code, signal) {
        console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal); // tslint:disable-line no-console
        console.log('Starting a new worker'); // tslint:disable-line no-console
        cluster.fork();
    });
}
else {
    app.listen(globalConfig["development"].serverPort, (err) => {
        if (err) {
            throw err;
        }
        console.log(`Server running on port ${globalConfig["development"].serverPort} with process id`, process.pid); // tslint:disable-line no-console
    });
}


/***/ }),

/***/ "cluster":
/*!**************************!*\
  !*** external "cluster" ***!
  \**************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("cluster");

/***/ }),

/***/ "express":
/*!**************************!*\
  !*** external "express" ***!
  \**************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("express");

/***/ }),

/***/ "os":
/*!*********************!*\
  !*** external "os" ***!
  \*********************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("os");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("path");

/***/ })

/******/ });
});
//# sourceMappingURL=server-api.js.map