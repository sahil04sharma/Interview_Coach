import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { conceptEdges } from '../src/intelligence/data/conceptEdges.js';
import { extraConcepts, roleCurricula } from '../src/intelligence/data/roleCurricula.js';

const prisma = new PrismaClient();

const companyStyles = [
  {
    name: 'general',
    styleNotes:
      'This is an all-around interview practice style, not tied to one company. Cover fundamentals that transfer everywhere: clear communication, structured thinking, depth on claimed skills, and honest trade-offs. Difficulty should match the candidate level. Mix breadth and follow-ups on weak topics. Tone is professional, fair, and strict — help them improve for any interview, not one brand.',
    philosophy: 'Universal interview readiness across product and service companies.',
    difficulty: 'medium',
    followUpAggressiveness: 'medium',
    behavioralWeight: 3,
    codingWeight: 3,
    systemDesignWeight: 3,
    communicationExpect: 'clear, structured, and natural',
    preferredAnswerStyle: 'structured with concrete examples and honest trade-offs',
  },
  {
    name: 'google',
    styleNotes:
      'Google interviews emphasize fundamentals, clarity of thought, and structured problem solving. Expect deep follow-ups that probe trade-offs and edge cases. Difficulty is high; vague answers get pushed hard. Tone is professional, curious, and exacting.',
    philosophy: 'Fundamentals-first with rigorous follow-ups on reasoning and edge cases.',
    difficulty: 'hard',
    followUpAggressiveness: 'high',
    behavioralWeight: 2,
    codingWeight: 5,
    systemDesignWeight: 4,
    communicationExpect: 'precise and structured under pressure',
    preferredAnswerStyle: 'clear problem framing, algorithms/complexity, trade-offs, edge cases',
  },
  {
    name: 'meta',
    styleNotes:
      'Meta interviews favor product sense, shipping speed, and concrete impact stories. Follow-ups dig into metrics, ownership, and how you handled ambiguity. Difficulty is high with a collaborative but intense tone. Prefer specifics over theory.',
    philosophy: 'Impact, ownership, and shipping under ambiguity.',
    difficulty: 'hard',
    followUpAggressiveness: 'high',
    behavioralWeight: 4,
    codingWeight: 4,
    systemDesignWeight: 4,
    communicationExpect: 'metric-aware and product-grounded',
    preferredAnswerStyle: 'concrete impact stories with metrics and ownership',
  },
  {
    name: 'amazon',
    styleNotes:
      'Amazon interviews are Leadership Principles driven with a strong bias for customer obsession and ownership. Expect behavioral depth plus practical technical questions. Follow-ups demand STAR structure and measurable outcomes. Tone is direct and bar-raising.',
    philosophy: 'Leadership Principles plus practical bar-raising technical depth.',
    difficulty: 'hard',
    followUpAggressiveness: 'high',
    behavioralWeight: 5,
    codingWeight: 4,
    systemDesignWeight: 3,
    communicationExpect: 'STAR-structured with ownership and metrics',
    preferredAnswerStyle: 'STAR stories tied to leadership principles with measurable results',
  },
  {
    name: 'microsoft',
    styleNotes:
      'Microsoft interviews value collaborative problem solving, clarity, and practical engineering judgment. Expect coding plus design questions with thoughtful follow-ups. Tone is professional and coaching-like but still exacting.',
    philosophy: 'Collaborative problem solving with practical engineering judgment.',
    difficulty: 'medium',
    followUpAggressiveness: 'medium',
    behavioralWeight: 3,
    codingWeight: 4,
    systemDesignWeight: 4,
    communicationExpect: 'collaborative and clear',
    preferredAnswerStyle: 'structured reasoning with practical trade-offs and teamwork awareness',
  },
  {
    name: 'netflix',
    styleNotes:
      'Netflix interviews emphasize high judgment, freedom and responsibility, and production-minded engineering. Expect deep probes into operational excellence, ownership, and complex systems. Difficulty is high; soft answers get challenged.',
    philosophy: 'High judgment, ownership, and production excellence.',
    difficulty: 'hard',
    followUpAggressiveness: 'high',
    behavioralWeight: 4,
    codingWeight: 3,
    systemDesignWeight: 5,
    communicationExpect: 'direct, high-context, ownership-heavy',
    preferredAnswerStyle: 'candid production stories with operational judgment',
  },
  {
    name: 'uber',
    styleNotes:
      'Uber interviews stress real-world scalability, marketplace dynamics, and practical debugging under load. Expect system design and incident-style questions. Follow-ups dig into reliability and trade-offs at scale.',
    philosophy: 'Marketplace-scale systems, reliability, and practical incident thinking.',
    difficulty: 'hard',
    followUpAggressiveness: 'high',
    behavioralWeight: 3,
    codingWeight: 4,
    systemDesignWeight: 5,
    communicationExpect: 'crisp under ambiguity',
    preferredAnswerStyle: 'scale-aware designs with reliability and marketplace trade-offs',
  },
  {
    name: 'startup',
    styleNotes:
      'Startup interviews value practical ownership, speed, and ability to wear multiple hats. Difficulty varies but expect hands-on problem solving and trade-offs under constraints. Follow-ups dig into what you built end-to-end. Tone is informal, fast, and results-oriented.',
    philosophy: 'End-to-end ownership under constraints and speed.',
    difficulty: 'medium',
    followUpAggressiveness: 'medium',
    behavioralWeight: 3,
    codingWeight: 4,
    systemDesignWeight: 3,
    communicationExpect: 'fast, practical, and concrete',
    preferredAnswerStyle: 'what you built, shipped, and owned end-to-end',
  },
  {
    name: 'tcs',
    styleNotes:
      'TCS interviews focus on core CS fundamentals, communication clarity, and willingness to work in delivery-oriented teams. Difficulty is moderate; expect process-aware questions and scenario-based checks. Tone is formal and structured. Follow-ups are lighter than FAANG but still expect clear basics.',
    philosophy: 'Fundamentals, communication, and delivery-team readiness.',
    difficulty: 'medium',
    followUpAggressiveness: 'low',
    behavioralWeight: 4,
    codingWeight: 3,
    systemDesignWeight: 2,
    communicationExpect: 'formal, clear, and structured',
    preferredAnswerStyle: 'clear basics with project and process awareness',
  },
  {
    name: 'infosys',
    styleNotes:
      'Infosys interviews emphasize fundamentals, coding basics, and clarity of communication for client-facing delivery roles. Difficulty is moderate with questions on concepts, projects, and adaptability. Tone is polite and formal. Follow-ups check confidence and consistency more than deep system design.',
    philosophy: 'Core concepts, coding basics, and client-facing clarity.',
    difficulty: 'medium',
    followUpAggressiveness: 'low',
    behavioralWeight: 4,
    codingWeight: 3,
    systemDesignWeight: 2,
    communicationExpect: 'polite, confident, and clear',
    preferredAnswerStyle: 'concept clarity with project examples',
  },
  {
    name: 'accenture',
    styleNotes:
      'Accenture interviews blend consulting communication with technical fundamentals. Expect scenario questions about clients, delivery, and collaboration plus core technical checks. Tone is professional and process-aware.',
    philosophy: 'Client-ready communication plus solid technical fundamentals.',
    difficulty: 'medium',
    followUpAggressiveness: 'medium',
    behavioralWeight: 4,
    codingWeight: 3,
    systemDesignWeight: 2,
    communicationExpect: 'consultative and client-ready',
    preferredAnswerStyle: 'business context plus technical clarity',
  },
  {
    name: 'wipro',
    styleNotes:
      'Wipro interviews focus on fundamentals, coding basics, and adaptability in enterprise delivery contexts. Difficulty is moderate. Expect project discussion, basic CS concepts, and communication checks. Tone is formal.',
    philosophy: 'Enterprise delivery fundamentals and adaptability.',
    difficulty: 'medium',
    followUpAggressiveness: 'low',
    behavioralWeight: 4,
    codingWeight: 3,
    systemDesignWeight: 2,
    communicationExpect: 'formal and clear',
    preferredAnswerStyle: 'project narrative with solid fundamentals',
  },
];

/** Starter concept tree: domain roots with children (parent → child via parentId). */
const conceptTrees = [
  {
    slug: 'caching',
    name: 'Caching',
    domain: 'caching',
    description: 'Caching strategies, invalidation, and in-memory stores',
    children: [
      {
        slug: 'redis',
        name: 'Redis',
        description: 'Redis as a cache and data store',
        children: [
          { slug: 'ttl', name: 'TTL', description: 'Time-to-live and expiry of cached keys' },
          { slug: 'eviction', name: 'Eviction', description: 'Eviction policies under memory pressure' },
          { slug: 'persistence', name: 'Persistence', description: 'RDB/AOF persistence modes' },
          { slug: 'replication', name: 'Replication', description: 'Master-replica replication' },
          { slug: 'redis-cluster', name: 'Cluster', description: 'Redis Cluster sharding and failover' },
          { slug: 'memory-optimization', name: 'Memory Optimization', description: 'Memory efficiency and data structures' },
        ],
      },
      { slug: 'cdn-caching', name: 'CDN Caching', description: 'Edge caching and cache headers' },
      { slug: 'cache-invalidation', name: 'Cache Invalidation', description: 'Invalidation strategies and consistency' },
    ],
  },
  {
    slug: 'databases',
    name: 'Databases',
    domain: 'databases',
    description: 'Relational and non-relational data systems',
    children: [
      { slug: 'sql', name: 'SQL', description: 'Relational queries and joins' },
      { slug: 'indexing', name: 'Indexing', description: 'B-tree / covering indexes and query plans' },
      { slug: 'transactions', name: 'Transactions', description: 'ACID, isolation levels' },
      { slug: 'normalization', name: 'Normalization', description: 'Schema design and normal forms' },
      { slug: 'nosql', name: 'NoSQL', description: 'Document and key-value stores' },
      { slug: 'sharding', name: 'Sharding', description: 'Horizontal partitioning strategies' },
    ],
  },
  {
    slug: 'system-design',
    name: 'System Design',
    domain: 'architecture',
    description: 'Distributed systems and architecture',
    children: [
      { slug: 'scalability', name: 'Scalability', description: 'Horizontal and vertical scaling' },
      { slug: 'load-balancing', name: 'Load Balancing', description: 'LB algorithms and health checks' },
      { slug: 'api-design', name: 'API Design', description: 'REST/GraphQL contracts and versioning' },
      { slug: 'microservices', name: 'Microservices', description: 'Service boundaries and communication' },
      { slug: 'message-queues', name: 'Message Queues', description: 'Async messaging and brokers' },
      { slug: 'consistency', name: 'Consistency', description: 'Consistency models and CAP trade-offs' },
    ],
  },
  {
    slug: 'frontend',
    name: 'Frontend',
    domain: 'frontend',
    description: 'Browser, UI frameworks, and client performance',
    children: [
      { slug: 'react', name: 'React', description: 'Components, state, and reconciliation' },
      { slug: 'javascript', name: 'JavaScript', description: 'Language fundamentals and runtime' },
      { slug: 'event-loop', name: 'Event Loop', description: 'Call stack, microtasks, macrotasks' },
      { slug: 'css-layout', name: 'CSS Layout', description: 'Flex, grid, and responsive layout' },
      { slug: 'browser-performance', name: 'Browser Performance', description: 'Rendering and web vitals' },
      { slug: 'accessibility', name: 'Accessibility', description: 'A11y and inclusive UI' },
    ],
  },
  {
    slug: 'backend',
    name: 'Backend',
    domain: 'backend',
    description: 'Server-side engineering fundamentals',
    children: [
      { slug: 'nodejs', name: 'Node.js', description: 'Node runtime and async I/O' },
      { slug: 'auth', name: 'Authentication', description: 'AuthN/AuthZ patterns' },
      { slug: 'rest-apis', name: 'REST APIs', description: 'HTTP APIs and status semantics' },
      { slug: 'concurrency', name: 'Concurrency', description: 'Locks, races, and parallelism' },
      { slug: 'security', name: 'Security', description: 'OWASP, XSS, CSRF, injection' },
      { slug: 'observability', name: 'Observability', description: 'Logging, metrics, tracing' },
    ],
  },
  {
    slug: 'behavioral',
    name: 'Behavioral',
    domain: 'behavioral',
    description: 'Leadership, collaboration, and story craft',
    children: [
      { slug: 'leadership', name: 'Leadership', description: 'Leading without and with authority' },
      { slug: 'conflict', name: 'Conflict', description: 'Handling disagreement constructively' },
      { slug: 'ownership', name: 'Ownership', description: 'End-to-end responsibility' },
      { slug: 'star-method', name: 'STAR Method', description: 'Situation, Task, Action, Result' },
    ],
  },
];

async function upsertConceptTree(node, parentId = null) {
  const concept = await prisma.concept.upsert({
    where: { slug: node.slug },
    update: {
      name: node.name,
      domain: node.domain || undefined,
      description: node.description || '',
      parentId,
    },
    create: {
      slug: node.slug,
      name: node.name,
      domain: node.domain || 'general',
      description: node.description || '',
      parentId,
    },
  });

  for (const child of node.children || []) {
    await upsertConceptTree(
      {
        ...child,
        domain: child.domain || node.domain || concept.domain,
      },
      concept.id,
    );
  }

  return concept;
}

async function main() {
  for (const style of companyStyles) {
    await prisma.companyStyle.upsert({
      where: { name: style.name },
      update: {
        styleNotes: style.styleNotes,
        philosophy: style.philosophy,
        difficulty: style.difficulty,
        followUpAggressiveness: style.followUpAggressiveness,
        behavioralWeight: style.behavioralWeight,
        codingWeight: style.codingWeight,
        systemDesignWeight: style.systemDesignWeight,
        communicationExpect: style.communicationExpect,
        preferredAnswerStyle: style.preferredAnswerStyle,
      },
      create: style,
    });
  }

  for (const tree of conceptTrees) {
    await upsertConceptTree(tree);
  }

  for (const concept of extraConcepts) {
    await prisma.concept.upsert({
      where: { slug: concept.slug },
      update: {
        name: concept.name,
        domain: concept.domain || 'general',
        description: concept.description || '',
      },
      create: {
        slug: concept.slug,
        name: concept.name,
        domain: concept.domain || 'general',
        description: concept.description || '',
      },
    });
  }

  for (const edge of conceptEdges) {
    await prisma.conceptEdge.upsert({
      where: {
        fromSlug_toSlug_type: {
          fromSlug: edge.fromSlug,
          toSlug: edge.toSlug,
          type: edge.type,
        },
      },
      update: { weight: edge.weight },
      create: edge,
    });
  }

  let competencyLinkCount = 0;
  for (const role of roleCurricula) {
    const curriculum = await prisma.roleCurriculum.upsert({
      where: { roleSlug: role.roleSlug },
      update: {
        displayName: role.displayName,
        summary: role.summary,
        status: 'active',
        source: 'seed',
      },
      create: {
        roleSlug: role.roleSlug,
        displayName: role.displayName,
        summary: role.summary,
        status: 'active',
        source: 'seed',
        version: 1,
      },
    });

    let sortOrder = 0;
    for (const comp of role.competencies) {
      sortOrder += 1;
      const competency = await prisma.roleCompetency.upsert({
        where: {
          curriculumId_slug: {
            curriculumId: curriculum.id,
            slug: comp.slug,
          },
        },
        update: {
          name: comp.name,
          description: comp.description || '',
          importance: comp.importance ?? 0.5,
          sortOrder,
        },
        create: {
          curriculumId: curriculum.id,
          slug: comp.slug,
          name: comp.name,
          description: comp.description || '',
          importance: comp.importance ?? 0.5,
          coverageTarget: 0.8,
          sortOrder,
        },
      });

      let conceptOrder = 0;
      for (const link of comp.concepts) {
        conceptOrder += 1;
        const concept = await prisma.concept.findUnique({ where: { slug: link.slug } });
        if (!concept) {
          console.warn(`[seed] Missing concept slug "${link.slug}" for role ${role.roleSlug}`);
          continue;
        }
        await prisma.roleCompetencyConcept.upsert({
          where: {
            competencyId_conceptId: {
              competencyId: competency.id,
              conceptId: concept.id,
            },
          },
          update: {
            difficultyBand: link.difficultyBand || 'medium',
            sortOrder: conceptOrder,
            isCore: link.isCore !== false,
          },
          create: {
            competencyId: competency.id,
            conceptId: concept.id,
            difficultyBand: link.difficultyBand || 'medium',
            sortOrder: conceptOrder,
            isCore: link.isCore !== false,
          },
        });
        competencyLinkCount += 1;
      }
    }
  }

  const conceptCount = await prisma.concept.count();
  const edgeCount = await prisma.conceptEdge.count();
  const roleCount = await prisma.roleCurriculum.count();
  console.log(
    `Seeded ${companyStyles.length} company styles, ${conceptCount} concepts, ${edgeCount} concept edges, ${roleCount} role curricula (${competencyLinkCount} competency↔concept links).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
