import * as httpStatus from 'http-status';

interface IErrorArgs {
    id?: String;
    statusCode: number;
    message: String;
}

const error = (args: IErrorArgs) => {
    return {
        id: args.id || 'notDefined',
        message: args.message,
        statusCode: args.statusCode,
        status: (httpStatus as any)[args.statusCode],
    };
};

const success = (data: any) => {
    return data;
};

export {
    error,
    success,
};
