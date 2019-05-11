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
        postgresDatabase: 'rili_db_main_dev',
        postgresHost: '127.0.0.1',
        postgresPassword: 'secret',
        postgresPort: 7432,
        postgresUser: 'riliAdmin',
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
        postgresDatabase: 'rili_db_main_prod',
        postgresHost: '127.0.0.1',
        postgresPassword: 'secret',
        postgresPort: 7432,
        postgresUser: 'riliAdmin',
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
// TODO: Configure to maintain migrations
const createTables = (connection) => {
    // Users
    const sql = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL NOT NULL,
            first_name VARCHAR(255),
            last_name VARCHAR(255) NOT NULL,
            phone_number VARCHAR(255) NOT NULL,
            PRIMARY KEY (id)
        );
    `;
    connection.query(sql, (err, results) => {
        if (err) {
            print_logs_1.default({
                shouldPrintLogs: server_api_1.shouldPrintSQLLogs,
                messageOrigin: `SQL:CREATE_TABLE:USERS`,
                messages: ['Users table failed to create', err.toString()],
            });
        }
        else {
            print_logs_1.default({
                shouldPrintLogs: server_api_1.shouldPrintSQLLogs,
                messageOrigin: `SQL:CREATE_TABLE:USERS`,
                messages: ['Users table created successfully'],
            });
        }
        connection.end();
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
const print_logs_1 = __webpack_require__(/*! rili-public-library/utilities/print-logs */ "../rili-public-library/utilities/lib/print-logs.js");
const server_api_1 = __webpack_require__(/*! ../server-api */ "./src/server-api.ts");
const router = express.Router();
class UserRoutes {
    constructor(connection) {
        this.router = router;
        this.getUser = (userId) => {
            return new Promise((resolve, reject) => {
                const sql = `SELECT * FROM users WHERE id = $1`;
                const values = [userId];
                this.connection.query(sql, values, (err, results) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    if (results && results.rows.length > 0) {
                        resolve(results.rows[0]);
                    }
                    else {
                        reject(404);
                    }
                });
            });
        };
        this.handleError = (err, res) => {
            // TODO: Handle various error status codes
            print_logs_1.default({
                shouldPrintLogs: server_api_1.shouldPrintSQLLogs,
                messageOrigin: `SQL:USER_ROUTES:ERROR`,
                messages: [err.toString()],
            });
        };
        // TODO: Determine if should end connection after each request
        this.connection = connection;
        // middleware to log time of a user route request
        router.use((req, res, next) => {
            print_logs_1.default({
                shouldPrintLogs: server_api_1.shouldPrintSQLLogs,
                messageOrigin: `SQL:USER_ROUTES:${req.method}`,
                messages: [req.baseUrl],
            });
            next();
        });
        router.route('/')
            .get((req, res) => {
            const sql = `
                    SELECT * from users;
                `;
            connection.query(sql, (err, results) => {
                if (err) {
                    this.handleError(err, res);
                    return;
                }
                res.send(results.rows);
                connection.end();
            });
        })
            .post((req, res) => {
            const sql = `
                    INSERT INTO users (first_name, last_name, phone_number) values($1, $2, $3) RETURNING *;
                `;
            const values = [req.body.firstName, req.body.lastName, req.body.phoneNumber];
            connection.query(sql, values, (err, results) => {
                if (err) {
                    this.handleError(err, res);
                    return;
                }
                res.send(results.rows[0]);
            });
        });
        router.route('/:id')
            .get((req, res) => {
            this.getUser(req.params.id).then((user) => {
                res.send(user);
            }).catch((err) => {
                this.handleError(err, res);
                if (err === 404) {
                    res.sendStatus(404);
                }
                else {
                    res.sendStatus(err.toString());
                }
            });
        })
            .put((req, res) => {
            const sql = `
                    UPDATE users
                    SET
                        first_name = $1,
                        last_name = $2,
                        phone_number = $3
                    WHERE id = $4;
                `;
            const values = [req.body.firstName, req.body.lastName, req.body.phoneNumber, req.params.id];
            connection.query(sql, values, (err, results) => {
                if (err) {
                    this.handleError(err, res);
                    return;
                }
                // TODO: Handle case where user already exists
                this.getUser(req.params.id).then((user) => {
                    res.send(user);
                });
            });
        })
            .delete((req, res) => {
            const sql = `
                    DELETE from users
                    WHERE id = $1;
                `;
            const values = [req.params.id];
            connection.query(sql, values, (err, results) => {
                if (err) {
                    this.handleError(err, res);
                    return;
                }
                console.log(results); //tslint:disable-line
                if (results.rowCount > 0) {
                    res.send(`Customer with id, ${req.params.id}, was successfully deleted`);
                }
                else {
                    res.sendStatus(404);
                }
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
const os = __webpack_require__(/*! os */ "os");
const path = __webpack_require__(/*! path */ "path");
const pg_1 = __webpack_require__(/*! pg */ "pg");
const yargs_1 = __webpack_require__(/*! yargs */ "yargs");
const print_logs_1 = __webpack_require__(/*! rili-public-library/utilities/print-logs */ "../rili-public-library/utilities/lib/print-logs.js");
const globalConfig = __webpack_require__(/*! ../../global-config.js */ "../global-config.js");
const create_tables_1 = __webpack_require__(/*! ./db/create-tables */ "./src/db/create-tables.ts");
const UserRoutes_1 = __webpack_require__(/*! ./routes/UserRoutes */ "./src/routes/UserRoutes.ts");
exports.shouldPrintAllLogs = yargs_1.argv.withAllLogs;
exports.shouldPrintSQLLogs = yargs_1.argv.withSQLLogs || exports.shouldPrintAllLogs;
const app = express();
// Parse JSON
app.use(bodyParser.json());
// Serves static files in the /build/static directory
app.use(express.static(path.join(__dirname, 'static')));
// Databse Connection
const postgressConfig = {
    user: globalConfig["development"].postgresUser,
    host: globalConfig["development"].postgresHost,
    database: globalConfig["development"].postgresDatabase,
    password: globalConfig["development"].postgresPassword,
    port: globalConfig["development"].postgresPort,
};
// Db Pool
const pool = new pg_1.Pool(postgressConfig);
pool.on('error', (err, client) => {
    print_logs_1.default({
        shouldPrintLogs: exports.shouldPrintSQLLogs,
        messageOrigin: `SQL:POOL:ERROR`,
        messages: [client.toString(), err.toString()],
    });
});
// Db Client
const client = new pg_1.Client(postgressConfig);
client.connect((err) => {
    if (err) {
        print_logs_1.default({
            shouldPrintLogs: exports.shouldPrintSQLLogs,
            messageOrigin: `SQL:CLIENT:CONNECTION_ERROR`,
            messages: [err.toString()],
        });
    }
    else {
        print_logs_1.default({
            shouldPrintLogs: exports.shouldPrintSQLLogs,
            messageOrigin: `SQL:CLIENT:CONNECTION_SUCCESS`,
            messages: ['Client connected to PostgreSQL'],
        });
        // Create or update database tables (if they don't yet exist)
        create_tables_1.default(client);
    }
});
client.on('error', (err) => {
    print_logs_1.default({
        shouldPrintLogs: exports.shouldPrintSQLLogs,
        messageOrigin: `SQL:CLIENT:ERROR`,
        messages: [err.toString()],
    });
});
// Routes
app.use('/users', (new UserRoutes_1.default(pool)).router);
// Cluster config and server start
if (cluster.isMaster && yargs_1.argv.shouldCluster) {
    const numWorkers = os.cpus().length;
    console.log(`Master cluster setting up ${numWorkers} workers...`); // tslint:disable-line no-console
    for (let i = 0; i < numWorkers; i += 1) {
        cluster.fork();
    }
    cluster.on('online', (worker) => {
        console.log(`Worker ${worker.process.pid} is online`); // tslint:disable-line no-console
    });
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died with code: ${code}, and signal: ${signal}`); // tslint:disable-line no-console
        console.log('Starting a new worker'); // tslint:disable-line no-console
        cluster.fork();
    });
}
else {
    app.listen(globalConfig["development"].apiPort, (err) => {
        if (err) {
            throw err;
        }
        console.log(`Server running on port ${globalConfig["development"].apiPort} with process id`, process.pid); // tslint:disable-line no-console
    });
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

/***/ "pg":
/*!*********************!*\
  !*** external "pg" ***!
  \*********************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("pg");

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