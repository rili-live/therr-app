import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const saltRounds = 12;

export const hashPassword = (password: string) => bcrypt.hash(password, saltRounds);

export const createUserToken = (user: any, userOrgs: any[], rememberMe?: boolean, brand?: string) => {
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

    // brand is omitted when undefined so legacy callers and pre-multi-app tokens already
    // in the wild keep their existing payload shape. Gateway treats a missing claim as
    // legacy / cross-brand-allowed.
    const payload: Record<string, any> = {
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
    };
    if (brand) {
        payload.brand = brand;
    }

    return jwt.sign(
        payload,
        (process.env.JWT_SECRET || ''),
        {
            algorithm: 'HS256',
            expiresIn: rememberMe ? '7d' : '1d',
        },
    );
};

export const createRefreshToken = (userId: string, rememberMe?: boolean, brand?: string) => {
    const jti = uuidv4();

    const payload: Record<string, any> = {
        jti,
        id: userId,
        type: 'refresh',
    };
    if (brand) {
        payload.brand = brand;
    }

    const token = jwt.sign(
        payload,
        (process.env.JWT_SECRET || ''),
        {
            algorithm: 'HS256',
            expiresIn: rememberMe ? '90d' : '30d',
        },
    );

    return {
        token, jti, brand,
    };
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
