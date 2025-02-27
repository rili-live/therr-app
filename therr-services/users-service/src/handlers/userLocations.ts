// import { RequestHandler } from 'express';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
// import translate from '../utilities/translator';

// READ
const getUserLocations = (req, res) => Store.userLocations.get({
    userId: req.params.userId,
})
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
    .then((results) => res.status(201).send({
        userLocations: results,
    }))
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
    createUserLocations,
    updateUserLocation,
};
