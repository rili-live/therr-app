/**
 * promiser
 * @param resolve: any
 * @param reject: any
 */
const promiser: Function = (resolve: any, reject: any) => {
    return (err: any, data: any) => {
        if (err) {
            reject(err);
        }

        resolve(data);
    };
};

export default promiser;
