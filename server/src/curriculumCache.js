import { createHash } from 'node:crypto';
import { prisma } from './db.js';
import { chatJson } from './llm.js';
import { buildRoleCurriculumMessages } from './prompts.js';

export function curriculumCacheKey({ targetRole, mode, jdText }) {
  const raw = [
    String(targetRole || 'software engineer').trim().toLowerCase(),
    String(mode || 'technical').trim().toLowerCase(),
    String(jdText || '').trim().slice(0, 800),
  ].join('||');
  return createHash('sha256').update(raw).digest('hex').slice(0, 40);
}

export async function getOrCreateCurriculum({ targetRole, mode, jdText, resumeText }) {
  const cacheKey = curriculumCacheKey({ targetRole, mode, jdText });

  const cached = await prisma.curriculumCache.findUnique({ where: { cacheKey } });
  if (cached?.curriculum) {
    try {
      return JSON.parse(cached.curriculum);
    } catch {
      // fall through and regenerate
    }
  }

  const roleCurriculum = await chatJson({
    messages: buildRoleCurriculumMessages({
      targetRole,
      mode,
      jdText: jdText || null,
      resumeText,
    }),
    temperature: 0.35,
  });

  await prisma.curriculumCache.upsert({
    where: { cacheKey },
    create: { cacheKey, curriculum: JSON.stringify(roleCurriculum) },
    update: { curriculum: JSON.stringify(roleCurriculum) },
  });

  return roleCurriculum;
}
