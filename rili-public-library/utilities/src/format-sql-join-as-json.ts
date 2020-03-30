// Ex.) `... as selectedANIs[].id`, `... as selectedANIs[].fvPhoneNumberId` ... gets reduced into an array of unique objects
// Ex.) `... as deliveryStrategy.method`, `... as deliveryStrategy.destination` ... gets formatted as an object

/**
 * formatSQLJoinAsJSON
 * Formats a SQL response from an innerJoin/leftOuterJoin/leftJoin/etc as usable JSON
 * @param {string} dataArray array of data returned from complex SQL query join
 * @param {string} arrayPropKeys array of strings representing intended object property keys for objects/arrays
 */
export default (dataArray: any, arrayPropKeys: any) => {
    const parsedDataArray = dataArray.map((data: any) => {
        const parsedObj: any = {};
        Object.keys(data).forEach((key) => {
            if (key.includes('.')) {
                const split = key.split('.');
                const splitKey = split[0].split('[]');
                const isArrayOfObjects = splitKey.length === 2;
                parsedObj[splitKey[0]] = parsedObj[splitKey[0]] || (isArrayOfObjects ? [{}] : {});
                if (isArrayOfObjects) {
                    parsedObj[splitKey[0]][0][split[1]] = data[key];
                } else {
                    parsedObj[splitKey[0]][split[1]] = data[key];
                }
            } else {
                parsedObj[key] = data[key];
            }
        });
        return parsedObj;
    });
    return parsedDataArray.reduce((acc: any, cur: any) => {
        const duplicateIndex = acc.findIndex(((obj: any) => obj.id === cur.id));
        if (duplicateIndex >= 0) {
            arrayPropKeys.forEach((propKey: any) => {
                if (Array.isArray(acc[duplicateIndex][propKey])) {
                    if (!acc[duplicateIndex][propKey].find((val: any) => cur[propKey][0].id === val.id)) {
                        acc[duplicateIndex][propKey] = acc[duplicateIndex][propKey].concat(cur[propKey]);
                    }
                }
            });
            return acc;
        }

        return acc.concat(cur);
    }, []);
};
