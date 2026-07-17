import { Router } from 'express';
import { requireAuth } from '../auth.js';
import {
  getActiveStudyPlan,
  getStudyPlanById,
  listStudyPlans,
} from '../services/studyPlanService.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const active = await getActiveStudyPlan(req.userId);
    const recent = await listStudyPlans(req.userId, { take: 8 });
    res.json({ active, recent });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const plan = await getStudyPlanById(req.userId, req.params.id);
    if (!plan) return res.status(404).json({ error: 'Study plan not found' });
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

export default router;
