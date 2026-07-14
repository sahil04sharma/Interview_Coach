import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const styles = await prisma.companyStyle.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, styleNotes: true },
    });

    // Put general practice first — company targets are optional filters.
    styles.sort((a, b) => {
      if (a.name === 'general') return -1;
      if (b.name === 'general') return 1;
      return a.name.localeCompare(b.name);
    });

    res.json(styles);
  } catch (err) {
    next(err);
  }
});

export default router;
