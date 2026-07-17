import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import companyStyleRoutes from './routes/companyStyles.js';
import sessionRoutes, { publicRouter as publicSessionRoutes } from './routes/session.js';
import codeRoutes from './routes/code.js';
import voiceRoutes from './routes/voice.js';
import knowledgeRoutes from './routes/knowledge.js';
import studyPlanRoutes from './routes/studyPlan.js';
import { requireAuth } from './auth.js';

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/company-styles', requireAuth, companyStyleRoutes);
app.use('/public', publicSessionRoutes);
app.use('/session', sessionRoutes);
app.use('/knowledge', knowledgeRoutes);
app.use('/study-plan', studyPlanRoutes);
app.use('/code', codeRoutes);
app.use('/voice', voiceRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  res.status(status).json({ error: err.message || 'Internal server error' });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
