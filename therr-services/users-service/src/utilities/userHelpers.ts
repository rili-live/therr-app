import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const saltRounds = 12;

export const hashPassword = (password: string) => bcrypt.hash(password, saltRounds);

export const createUserToken = (user: any, userOrgs: any[], rememberMe?: boolean) => {
    const {
        id,
        userName,
        email,
        phoneNumber,
        integrations,
        isBlocked,
        isSSO,
        accessLevels,
    } = user;
    const mappedUserOrgs = userOrgs
        .filter((o) => o.inviteStatus === 'accepted' && o.isEnabled)
        .reduce((acc, cur) => {
            acc[cur.organizationId] = cur.accessLevels;
            return acc;
        }, {});
    const jti = uuidv4();

    // Sign the JWT
    return jwt.sign(
        {
            jti,
            id,
            userName,
            email,
            phoneNumber,
            isBlocked,
            integrations,
            isSSO: isSSO || false,
            accessLevels,
            organizations: mappedUserOrgs,
        },
        (process.env.JWT_SECRET || ''),
        {
            algorithm: 'HS256',
            expiresIn: rememberMe ? '7d' : '1d',
        },
    );
};

export const createRefreshToken = (userId: string, rememberMe?: boolean) => {
    const jti = uuidv4();

    const token = jwt.sign(
        {
            jti,
            id: userId,
            type: 'refresh',
        },
        (process.env.JWT_SECRET || ''),
        {
            algorithm: 'HS256',
            expiresIn: rememberMe ? '30d' : '7d',
        },
    );

    return { token, jti };
};

export const createUserEmailToken = (user: { id: string, email: string }) => {
    const {
        id,
        email,
    } = user;

    // Sign the JWT
    return jwt.sign(
        {
            id,
            email,
        },
        (process.env.JWT_EMAIL_SECRET || ''),
        {
            algorithm: 'HS256',
            expiresIn: '24h',
        },
    );
};
