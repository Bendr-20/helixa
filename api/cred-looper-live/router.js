'use strict';

const { createLooperCredService } = require('./service');

function createLooperCredRouter({ expressModule, service = createLooperCredService() } = {}) {
  if (!expressModule || typeof expressModule.Router !== 'function') throw new TypeError('expressModule.Router is required');
  if (!service || typeof service.getByLooperId !== 'function') throw new TypeError('service.getByLooperId is required');
  const router = expressModule.Router();
  router.get('/:id/cred', async (req, res) => {
    try {
      const record = await service.getByLooperId(req.params.id);
      res.set('Cache-Control', 'no-store');
      return res.json(record);
    } catch (error) {
      res.set('Cache-Control', 'no-store');
      if (error && error.code === 'UNSUPPORTED_LOOPER') {
        return res.status(404).json({ error: 'UNSUPPORTED_LOOPER', detail: 'Looper is not in the closed live CRED pilot registry' });
      }
      return res.status(503).json({
        error: 'LOOPER_CRED_UNAVAILABLE',
        ratingStatus: 'UNRATED',
        score: null,
        effectivePrivilegeTier: null,
        confidence: null,
        coverage: null,
        reasonCodes: ['LOOPER_CRED_EVIDENCE_UNAVAILABLE'],
      });
    }
  });
  return router;
}

module.exports = Object.freeze({ createLooperCredRouter });
