import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

const saltRounds = 10;

export const hashPassword = (password: string) => bcrypt.hash(password, saltRounds);

export const createUserToken = (user: any, rememberMe?: boolean) => {
    const {
        id,
        userName,
        email,
        phoneNumber,
        isBlocked,
        isSSO,
        accessLevels,
    } = user;
    // Sign the JWT
    return jwt.sign(
        {
            id,
            userName,
            email,
            phoneNumber,
            isBlocked,
            isSSO: isSSO || false,
            accessLevels,
        },
        (process.env.JWT_SECRET || ''),
        {
            algorithm: 'HS256',
            expiresIn: rememberMe ? '30d' : '10d',
        },
    );
};
