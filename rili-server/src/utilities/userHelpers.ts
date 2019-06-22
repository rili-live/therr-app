import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

const saltRounds = 10;

export const hashPassword = (password: string) => {
    return bcrypt.hash(password, saltRounds);
};

export const createUserToken = (user: any, rememberMe?: boolean) => {
    // Sign the JWT
    return jwt.sign(
        {
            id: user.id,
            userName: user.userName,
        },
        process.env.SECRET,
        {
            algorithm: 'HS256',
            expiresIn: rememberMe ? '30d' : '4h',
        },
    );
};
