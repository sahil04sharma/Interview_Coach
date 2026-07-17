import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getConceptDetail, listKnowledge } from '../services/knowledgeService.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { status, domain } = req.query || {};
    const data = await listKnowledge({
      userId: req.userId,
      status: status || undefined,
      domain: domain || undefined,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const detail = await getConceptDetail(req.userId, req.params.slug);
    if (!detail) return res.status(404).json({ error: 'Concept not found' });
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

export default router;
