import { Router } from 'express';
import { prisma } from '../db.js';
import {
  hashPassword,
  publicUser,
  requireAuth,
  signToken,
  verifyPassword,
} from '../auth.js';

const router = Router();

function validateCredentials(email, password) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return 'Valid email is required';
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return 'Password must be at least 6 characters';
  }
  return null;
}

router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    const validationError = validateCredentials(email, password);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: (typeof name === 'string' && name.trim()) || normalizedEmail.split('@')[0],
        resumeText: '',
      },
    });

    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/signin', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const validationError = validateCredentials(email, password);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(publicUser(user));
  } catch (err) {
    next(err);
  }
});

export default router;
