import { RequestHandler } from 'express';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { parseHeaders } from 'therr-js-utilities/http';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { AccessLevels } from 'therr-js-utilities/constants';
// eslint-disable-next-line import/extensions, import/no-unresolved
import normalizeCorrectionValue, { SpaceCorrectionFieldName } from 'therr-js-utilities/normalize-correction-value';
// eslint-disable-next-line import/extensions, import/no-unresolved
import logSpan from 'therr-js-utilities/log-or-update-span';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { SUPER_ADMIN_ID } from '../constants';

const ALLOWED_FIELDS: SpaceCorrectionFieldName[] = ['phoneNumber', 'websiteUrl', 'openingHours'];

const getThreshold = (): number => {
    const raw = process.env.CORRECTION_AGREEMENT_THRESHOLD;
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
};

const submitCorrection: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { spaceId } = req.params;
    const { fieldName, value } = req.body || {};

    if (!ALLOWED_FIELDS.includes(fieldName)) {
        return handleHttpError({
            res,
            message: 'INVALID_FIELD_NAME',
            statusCode: 400,
        });
    }

    const normalization = normalizeCorrectionValue(fieldName as SpaceCorrectionFieldName, value);
    if (!normalization.ok) {
        return handleHttpError({
            res,
            message: `INVALID_VALUE:${normalization.error}`,
            statusCode: 400,
        });
    }

    // Identity. Authed users use userId; anonymous users present a
    // pre-computed identity hash supplied by the gateway (where the real
    // client IP is accessible via trust-proxy). Maps-service is internal-only,
    // so trusting this header is safe.
    let submitterIdentityHash: string | undefined;
    if (!userId) {
        const headerHash = (req.headers['x-correction-identity-hash'] || '').toString().trim();
        if (!headerHash) {
            return handleHttpError({
                res,
                message: 'MISSING_ANON_IDENTITY',
                statusCode: 400,
            });
        }
        submitterIdentityHash = headerHash;
    }

    const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 512);
    const threshold = getThreshold();

    try {
        const result = await Store.spaceCorrections.submitAndMaybeApply(
            {
                spaceId,
                userId: userId || undefined,
                submitterIdentityHash,
                fieldName: fieldName as SpaceCorrectionFieldName,
                submittedValue: normalization.canonical,
                normalizedValue: normalization.normalized,
                userAgent: userAgent || undefined,
            },
            { threshold, superAdminId: SUPER_ADMIN_ID },
        );

        if (!result.spaceExists) {
            return handleHttpError({
                res,
                message: 'SPACE_NOT_FOUND',
                statusCode: 404,
            });
        }

        logSpan({
            level: 'info',
            messageOrigin: 'API_SERVER',
            messages: ['Space correction submitted'],
            traceArgs: {
                'space.id': spaceId,
                'correction.fieldName': fieldName,
                'correction.didApply': result.didApply,
                'correction.agreementCount': result.agreementCount,
                'correction.isOwnerClaimed': result.isOwnerClaimed,
                'correction.isAnonymous': !userId,
                source: 'maps-service',
            },
        });

        return res.status(201).send({
            spaceId,
            status: result.didApply ? 'applied' : 'pending',
            agreementCount: result.agreementCount,
            threshold,
            isOwnerClaimed: result.isOwnerClaimed,
        });
    } catch (err) {
        return handleHttpError({ err, res, message: 'SQL:SPACE_CORRECTIONS:SUBMIT' });
    }
};

const getCorrectionsSummary: RequestHandler = async (req: any, res: any) => {
    const { userId, userAccessLevels } = parseHeaders(req.headers);
    const { spaceId } = req.params;

    if (!userId) {
        return handleHttpError({ res, message: 'UNAUTHORIZED', statusCode: 401 });
    }

    // Authorization: only the space owner or a super admin can read pending
    // corrections. Surfacing them publicly would let vandals coordinate
    // submissions ("1 more needed").
    let space: any;
    try {
        const rows = await Store.spaces.getByIdSimple(spaceId);
        space = rows?.[0];
    } catch (err) {
        return handleHttpError({ err, res, message: 'SQL:SPACE_CORRECTIONS:LOOKUP' });
    }

    if (!space) {
        return handleHttpError({ res, message: 'SPACE_NOT_FOUND', statusCode: 404 });
    }

    const isOwner = space.fromUserId === userId;
    const isSuperAdmin = Array.isArray(userAccessLevels)
        && userAccessLevels.includes(AccessLevels.SUPER_ADMIN);
    if (!isOwner && !isSuperAdmin) {
        return handleHttpError({ res, message: 'FORBIDDEN', statusCode: 403 });
    }

    try {
        const rows = await Store.spaceCorrections.getPendingSummary(spaceId);
        return res.status(200).send({ corrections: rows, threshold: getThreshold() });
    } catch (err) {
        return handleHttpError({ err, res, message: 'SQL:SPACE_CORRECTIONS:SUMMARY' });
    }
};

export { submitCorrection, getCorrectionsSummary };
