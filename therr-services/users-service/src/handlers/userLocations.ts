// import { RequestHandler } from 'express';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import TherrEventEmitter from '../api/TherrEventEmitter';
import { DISTRIBUTOR_MIN_SECONDS_BETWEEN_RUNS } from '../utilities/distributorGate';
// import translate from '../utilities/translator';

// READ
const getUserLocations = (req, res) => Store.userLocations.get({
    userId: req.params.userId,
})
    .then((results) => res.status(200).send({
        userLocations: results,
    }))
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_LOCATIONS_ROUTES:ERROR' }));

// Locations where the user lives or is currently staying (home, hotel, apartment, etc.)
const getUserDwellingLocations = (req, res) => Store.userLocations.getDwellings(req.params.userId)
    .then((results) => res.status(200).send({
        userLocations: results,
    }))
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_LOCATIONS_ROUTES:ERROR' }));

// WRTIE
const createUserLocations = (req, res) => Store.userLocations.create([{
    userId: req.params.userId,
    isDeclaredHome: req.body.isDeclaredHome,
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    latitudeRounded: req.body.latitudeRounded,
    longitudeRounded: req.body.longitudeRounded,
    visitCount: req.body.visitCount,
}])
    .then((results) => {
        /**
         * Re-seed the user's stream now that we know where they are.
         *
         * This is what makes "share your location, see posts about your city" immediate
         * rather than something that shows up at the next login. It matters most for a user
         * who just signed up: login seeds their stream before any location exists, so
         * without this their first session has no local content in it at all.
         *
         * Gated on the same per-user window as the notifications poll, and deliberately so.
         * `main.userLocations` rows are keyed on coordinates rounded to ~111m, so a client
         * reporting background movement creates new rows continuously — an ungated run here
         * would fire on every few steps the user takes. Sharing the window means location
         * pings add no runs beyond what polling already allows, while the first ping after a
         * sign-in still runs immediately (login itself passes 0 and never claims the window).
         *
         * Fire and forget after the response: the client is reporting a location, not asking
         * for a feed, and a distributor failure must not turn into a failed location write.
         *
         * Skipped unless the authenticated header names the same user as the path. Every
         * reaction the run creates is written under `x-userid`, so running for the path
         * parameter instead would let a caller seed somebody else's stream; a mismatch here
         * means only that this one location write does not also re-seed a feed.
         */
        if (req.headers['x-userid'] && req.headers['x-userid'] === req.params.userId) {
            setImmediate(() => {
                TherrEventEmitter.runThoughtDistributorAlgorithm(
                    req.headers,
                    [req.params.userId],
                    'createdAt',
                    10,
                    DISTRIBUTOR_MIN_SECONDS_BETWEEN_RUNS,
                );
            });
        }

        return res.status(201).send({
            userLocations: results,
        });
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_LOCATIONS_ROUTES:ERROR' }));

const updateUserLocation = (req, res) => Store.userLocations.update(req.params.userLocationId, {
    isDeclaredHome: req.body.isDeclaredHome,
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    lastPushNotificationSent: req.body.lastPushNotificationSent,
})
    .then((results) => res.status(200).send({
        userLocations: results,
    }))
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_LOCATIONS_ROUTES:ERROR' }));

export {
    getUserLocations,
    getUserDwellingLocations,
    createUserLocations,
    updateUserLocation,
};
