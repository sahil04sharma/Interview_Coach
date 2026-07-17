import { prisma } from '../db.js';
import { buildRoleAliasMap, roleCurricula } from './data/roleCurricula.js';
import { isIntelligenceV2Enabled } from './cognitiveModel.js';

const aliasMap = buildRoleAliasMap();

export function isRoleCurriculumEnabled() {
  return (
    isIntelligenceV2Enabled() &&
    String(process.env.ROLE_CURRICULUM_V1 || '').toLowerCase() === 'true'
  );
}

/**
 * Normalize free-text targetRole → roleSlug (or null if unknown).
 */
export function resolveRoleSlug(targetRole) {
  if (!targetRole || !String(targetRole).trim()) return null;
  const key = String(targetRole).trim().toLowerCase();
  if (aliasMap.has(key)) return aliasMap.get(key);

  // Fuzzy contains: "Senior MERN Stack Developer" → mern-stack
  for (const [alias, slug] of aliasMap.entries()) {
    if (alias.length >= 4 && key.includes(alias)) return slug;
  }
  return null;
}

/**
 * Load master curriculum for a role (read-only syllabus).
 */
export async function getRoleCurriculumBySlug(roleSlug) {
  if (!roleSlug) return null;
  return prisma.roleCurriculum.findUnique({
    where: { roleSlug },
    include: {
      competencies: {
        orderBy: { sortOrder: 'asc' },
        include: {
          concepts: {
            orderBy: { sortOrder: 'asc' },
            include: {
              concept: true,
            },
          },
        },
      },
    },
  });
}

export async function getRoleCurriculumForTargetRole(targetRole) {
  const slug = resolveRoleSlug(targetRole);
  if (!slug) return null;
  return getRoleCurriculumBySlug(slug);
}

/**
 * Compact brief for Interview Brain / planner context.
 */
export function toCurriculumBrief(curriculum) {
  if (!curriculum) return null;
  return {
    roleSlug: curriculum.roleSlug,
    displayName: curriculum.displayName,
    version: curriculum.version,
    summary: curriculum.summary,
    competencies: (curriculum.competencies || []).map((c) => ({
      slug: c.slug,
      name: c.name,
      importance: c.importance,
      concepts: (c.concepts || []).map((link) => ({
        slug: link.concept.slug,
        name: link.concept.name,
        difficultyBand: link.difficultyBand,
        isCore: link.isCore,
      })),
    })),
  };
}

/**
 * Ensure user is enrolled in the curriculum for their target role.
 */
export async function ensurePrimaryEnrollment(userId, targetRole) {
  const curriculum = await getRoleCurriculumForTargetRole(targetRole);
  if (!curriculum) return null;

  const existing = await prisma.userRoleEnrollment.findUnique({
    where: {
      userId_curriculumId: {
        userId,
        curriculumId: curriculum.id,
      },
    },
  });

  if (existing) {
    if (!existing.isPrimary) {
      await prisma.userRoleEnrollment.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });
      return prisma.userRoleEnrollment.update({
        where: { id: existing.id },
        data: { isPrimary: true },
      });
    }
    return existing;
  }

  await prisma.userRoleEnrollment.updateMany({
    where: { userId, isPrimary: true },
    data: { isPrimary: false },
  });

  return prisma.userRoleEnrollment.create({
    data: {
      userId,
      curriculumId: curriculum.id,
      isPrimary: true,
    },
  });
}

export function listSeededRoleSlugs() {
  return roleCurricula.map((r) => ({
    roleSlug: r.roleSlug,
    displayName: r.displayName,
    aliases: r.aliases || [],
  }));
}
