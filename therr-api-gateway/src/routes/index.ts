import * as express from 'express';

const router = express.Router();

// READ
router.get('/', (req, res) => res.status(201).send({ hello: 'api gateway' }));

export default router;
