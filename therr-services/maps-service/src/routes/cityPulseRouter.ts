import * as express from 'express';
import getCityPulse from '../handlers/cityPulse';

const router = express.Router();

router.get('/:slug/pulse', getCityPulse);

export default router;
