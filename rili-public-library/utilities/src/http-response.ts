import * as httpStatus from 'http-status';

const error = (statusCode: number, error: string) => {
    return {
        error,
        statusCode,
        status: (httpStatus as any)[statusCode],
    };
};

const success = (data: any) => {
    return data;
};

export {
    error,
    success,
};
