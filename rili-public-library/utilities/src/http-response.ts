import * as httpStatus from 'http-status';

interface IErrorArgs {
    id?: string;
    statusCode: number;
    message: string;
}

const error = (args: IErrorArgs) => ({
    id: args.id || 'notDefined',
    message: args.message,
    statusCode: args.statusCode,
    status: (httpStatus as any)[args.statusCode],
});

const success = (data: any) => data;

export {
    error,
    success,
};
