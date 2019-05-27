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
        socket: {
            pingInterval: 1000 * 10,
            pingTimeout: 1000 * 5,
            userSocketSessionExpire: 1000 * 60 * 60,
        },
    },
};


/***/ }),

/***/ "../rili-public-library/utilities/lib/http-response.js":
/*!*************************************************************!*\
  !*** ../rili-public-library/utilities/lib/http-response.js ***!
  \*************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

!function(e,t){ true?module.exports=t(__webpack_require__(/*! http-status */ "http-status")):undefined}(global,function(e){return function(e){var t={};function r(n){if(t[n])return t[n].exports;var o=t[n]={i:n,l:!1,exports:{}};return e[n].call(o.exports,o,o.exports,r),o.l=!0,o.exports}return r.m=e,r.c=t,r.d=function(e,t,n){r.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:n})},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},r.t=function(e,t){if(1&t&&(e=r(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)r.d(n,o,function(t){return e[t]}.bind(null,o));return n},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,"a",t),t},r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.p="/",r(r.s="rPjh")}({Os7e:function(t,r){t.exports=e},rPjh:function(e,t,r){"use strict";Object.defineProperty(t,"__esModule",{value:!0});const n=r("Os7e");t.error=((e,t)=>({error:t,statusCode:e,status:n[e]}));t.success=(e=>({data:e}))}})});

/***/ }),

/***/ "../rili-public-library/utilities/lib/print-logs.js":
/*!**********************************************************!*\
  !*** ../rili-public-library/utilities/lib/print-logs.js ***!
  \**********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

!function(e,t){ true?module.exports=t():undefined}(global,function(){return function(e){var t={};function r(n){if(t[n])return t[n].exports;var o=t[n]={i:n,l:!1,exports:{}};return e[n].call(o.exports,o,o.exports,r),o.l=!0,o.exports}return r.m=e,r.c=t,r.d=function(e,t,n){r.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:n})},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},r.t=function(e,t){if(1&t&&(e=r(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)r.d(n,o,function(t){return e[t]}.bind(null,o));return n},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,"a",t),t},r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.p="/",r(r.s="Sxyf")}({Sxyf:function(e,t,r){"use strict";Object.defineProperty(t,"__esModule",{value:!0});t.default=(e=>{if(e.shouldPrintLogs){const t=0!==e.time?`<at:${e.time||new Date}>`:"",r=Array.isArray(e.messages)?e.messages:[e.messages];for(let n=0;n<r.length;n+=1)e.messageOrigin?console.info(`${e.messageOrigin}${t}:`,r[n]):console.info(`LOG${t}:`,r[n])}})}})});

/***/ }),

/***/ "./src/db/create-tables.ts":
/*!*********************************!*\
  !*** ./src/db/create-tables.ts ***!
  \*********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const print_logs_1 = __webpack_require__(/*! rili-public-library/utilities/print-logs */ "../rili-public-library/utilities/lib/print-logs.js");
const server_api_1 = __webpack_require__(/*! ../server-api */ "./src/server-api.ts");
const notProd = "development" !== 'production';
// TODO: Configure to maintain migrations
const createTables = (knex) => {
    // Users
    return knex.schema.hasTable('main.users').then((exists) => {
        if (!exists) {
            return knex.schema.createTable('main.users', (table) => {
                table.increments('id');
                table.string('user_name');
                table.string('first_name');
                table.string('last_name');
                table.string('phone_number');
                table.timestamps();
            }).debug(notProd).then(() => {
                print_logs_1.default({
                    shouldPrintLogs: server_api_1.shouldPrintSQLLogs,
                    messageOrigin: `SQL:CREATE_TABLE:USERS`,
                    messages: ['Users table created successfully'],
                });
            }).catch((err) => {
                print_logs_1.default({
                    shouldPrintLogs: server_api_1.shouldPrintSQLLogs,
                    messageOrigin: `SQL:CREATE_TABLE:USERS`,
                    messages: ['Users table failed to create', err.toString()],
                });
            });
        }
        return;
    });
};
exports.default = createTables;


/***/ }),

/***/ "./src/routes/UserRoutes.ts":
/*!**********************************!*\
  !*** ./src/routes/UserRoutes.ts ***!
  \**********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const express = __webpack_require__(/*! express */ "express");
const httpResponse = __webpack_require__(/*! rili-public-library/utilities/http-response */ "../rili-public-library/utilities/lib/http-response.js");
const print_logs_1 = __webpack_require__(/*! rili-public-library/utilities/print-logs */ "../rili-public-library/utilities/lib/print-logs.js");
const server_api_1 = __webpack_require__(/*! ../server-api */ "./src/server-api.ts");
const router = express.Router();
const notProd = "development" !== 'production';
class UserRoutes {
    constructor(knex) {
        this.router = router;
        this.getUser = (userId) => {
            return this.knex.select('*').from('main.users').where({ id: userId }).debug(notProd)
                .then((results) => {
                if (results && results.length > 0) {
                    return results[0];
                }
                throw 404;
            });
        };
        this.handleError = (err, res) => {
            // TODO: Handle various error status codes
            print_logs_1.default({
                shouldPrintLogs: server_api_1.shouldPrintSQLLogs,
                messageOrigin: `SQL:USER_ROUTES:ERROR`,
                messages: [err.toString()],
            });
            res.status(500).end(httpResponse.error(500, err.toString()));
        };
        // TODO: Determine if should end connection after each request
        this.knex = knex;
        // middleware to log time of a user route request
        router.use((req, res, next) => {
            print_logs_1.default({
                shouldPrintLogs: server_api_1.shouldPrintSQLLogs,
                messageOrigin: `SQL:USER_ROUTES:${req.method}`,
                messages: [req.baseUrl],
            });
            next();
        });
        router.route('/users')
            .get((req, res) => {
            knex.select('*').from('main.users').orderBy('id').debug(notProd)
                .then((results) => {
                res.status(200).send(httpResponse.success(results));
            })
                .catch((err) => {
                this.handleError(err, res);
                return;
            });
        })
            .post((req, res) => {
            knex().insert({
                first_name: req.body.firstName,
                last_name: req.body.lastName,
                phone_number: req.body.phoneNumber,
                user_name: req.body.userName,
            }).into('main.users').returning('id').debug(notProd)
                .then((results) => {
                res.status(201).send(httpResponse.success({
                    id: results[0],
                }));
                return;
            })
                .catch((err) => {
                this.handleError(err, res);
                return;
            });
        });
        router.route('/users/:id')
            .get((req, res) => {
            return this.getUser(req.params.id).then((user) => {
                res.send(httpResponse.success(user));
            }).catch((err) => {
                if (err === 404) {
                    res.status(404).send(httpResponse.error(404, `No user found with id, ${req.params.id}.`));
                }
                else {
                    this.handleError(err, res);
                }
            });
        })
            .put((req, res) => {
            knex()
                .update({
                first_name: req.body.firstName,
                last_name: req.body.lastName,
                phone_number: req.body.phoneNumber,
                user_name: req.body.userName,
            })
                .into('main.users')
                .where({ id: req.params.id }).returning('*').debug(notProd)
                .then((results) => {
                // TODO: Handle case where user already exists
                return this.getUser(req.params.id).then((user) => {
                    res.status(200).send(httpResponse.success(user));
                });
            })
                .catch((err) => {
                this.handleError(err, res);
                return;
            });
        })
            .delete((req, res) => {
            knex.delete().from('main.users').where({ id: req.params.id })
                .then((results) => {
                if (results > 0) {
                    res.status(200).send(httpResponse.success(`Customer with id, ${req.params.id}, was successfully deleted`));
                }
                else {
                    res.status(404).send(httpResponse.error(404, `No user found with id, ${req.params.id}.`));
                }
            })
                .catch((err) => {
                this.handleError(err, res);
                return;
            });
        });
    }
}
exports.default = UserRoutes;


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
const bodyParser = __webpack_require__(/*! body-parser */ "body-parser");
const express = __webpack_require__(/*! express */ "express");
const fs = __webpack_require__(/*! fs */ "fs");
const https = __webpack_require__(/*! https */ "https");
const os = __webpack_require__(/*! os */ "os");
const path = __webpack_require__(/*! path */ "path");
const yargs_1 = __webpack_require__(/*! yargs */ "yargs");
const Knex = __webpack_require__(/*! knex */ "knex");
const globalConfig = __webpack_require__(/*! ../../global-config.js */ "../global-config.js");
const print_logs_1 = __webpack_require__(/*! rili-public-library/utilities/print-logs */ "../rili-public-library/utilities/lib/print-logs.js");
const create_tables_1 = __webpack_require__(/*! ./db/create-tables */ "./src/db/create-tables.ts");
const UserRoutes_1 = __webpack_require__(/*! ./routes/UserRoutes */ "./src/routes/UserRoutes.ts");
exports.shouldPrintAllLogs = yargs_1.argv.withAllLogs;
exports.shouldPrintSQLLogs = yargs_1.argv.withSQLLogs || exports.shouldPrintAllLogs;
exports.shouldPrintServerLogs = yargs_1.argv.withServerLogs || exports.shouldPrintAllLogs;
const API_BASE_ROUTE = '/api';
const app = express();
// Parse JSON
app.use(bodyParser.json());
// Serves static files in the /build/static directory
app.use(express.static(path.join(__dirname, 'static')));
// Databse Connection
const dbConnectionConfig = {
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
};
const knex = Knex({
    client: 'pg',
    connection: dbConnectionConfig,
    pool: {
        min: 2,
        max: 10,
        log: true,
    },
    acquireConnectionTimeout: 60000,
});
create_tables_1.default(knex).then(() => {
    app.use(API_BASE_ROUTE, (new UserRoutes_1.default(knex)).router);
});
// Cluster config and server start
if (cluster.isMaster && yargs_1.argv.shouldCluster) {
    const numWorkers = os.cpus().length;
    print_logs_1.default({
        shouldPrintLogs: exports.shouldPrintServerLogs,
        messageOrigin: 'API_SERVER',
        messages: `Master cluster setting up ${numWorkers} workers...`,
    });
    for (let i = 0; i < numWorkers; i += 1) {
        cluster.fork();
    }
    cluster.on('online', (worker) => {
        print_logs_1.default({
            shouldPrintLogs: exports.shouldPrintServerLogs,
            messageOrigin: 'API_SERVER',
            messages: `Worker ${worker.process.pid} is online`,
        });
    });
    cluster.on('exit', (worker, code, signal) => {
        print_logs_1.default({
            shouldPrintLogs: exports.shouldPrintServerLogs,
            messageOrigin: 'API_SERVER',
            messages: `Worker ${worker.process.pid} died with code: ${code}, and signal: ${signal}`,
        });
        print_logs_1.default({
            shouldPrintLogs: exports.shouldPrintServerLogs,
            messageOrigin: 'API_SERVER',
            messages: 'Starting a new worker',
        });
        cluster.fork();
    });
}
else {
    if (false) {}
    else {
        app.listen(globalConfig["development"].apiPort, (err) => {
            if (err) {
                throw err;
            }
            print_logs_1.default({
                shouldPrintLogs: exports.shouldPrintServerLogs,
                messageOrigin: 'API_SERVER',
                messages: [`Server running on port ${globalConfig["development"].apiPort} with process id`, process.pid],
            });
        });
    }
}


/***/ }),

/***/ "body-parser":
/*!******************************!*\
  !*** external "body-parser" ***!
  \******************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("body-parser");

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

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("fs");

/***/ }),

/***/ "http-status":
/*!******************************!*\
  !*** external "http-status" ***!
  \******************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("http-status");

/***/ }),

/***/ "https":
/*!************************!*\
  !*** external "https" ***!
  \************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("https");

/***/ }),

/***/ "knex":
/*!***********************!*\
  !*** external "knex" ***!
  \***********************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("knex");

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

/***/ }),

/***/ "yargs":
/*!************************!*\
  !*** external "yargs" ***!
  \************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("yargs");

/***/ })

/******/ });
});
//# sourceMappingURL=server-api.js.map