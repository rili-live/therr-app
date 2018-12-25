import * as cluster from 'cluster';
import * as express from 'express';
import * as os from 'os';
import * as config from '../config.js';

let app = express();
app.use(express.static('static'));

// Cluster config and server start
if (cluster.isMaster) {
    let numWorkers = os.cpus().length;

    console.log('Master cluster setting up ' + numWorkers + ' workers...'); // tslint:disable-line no-console

    for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
    }

    cluster.on('online', function(worker) {
        console.log('Worker ' + worker.process.pid + ' is online'); // tslint:disable-line no-console
    });

    cluster.on('exit', function(worker, code, signal) {
        console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal); // tslint:disable-line no-console
        console.log('Starting a new worker'); // tslint:disable-line no-console
        cluster.fork();
    });
} else {
    app.listen(config.serverPort, (err: string) => {
        if (err) {
            throw err;
        }
        console.log('Server running with process id', process.pid); // tslint:disable-line no-console
    });
}
