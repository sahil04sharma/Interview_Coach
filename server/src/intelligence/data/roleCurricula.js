/**
 * Master role curricula — global syllabus per role (not per user).
 * Concepts are referenced by slug and must exist in the Concept table (seeded separately).
 * Extra concepts listed here are upserted during seed.
 */

/** Extra concepts not in the original SWE tree (Android, Data Analyst, auth depth, etc.) */
export const extraConcepts = [
  // Auth depth
  { slug: 'sessions', name: 'Sessions', domain: 'backend', description: 'Server-side session auth' },
  { slug: 'jwt', name: 'JWT', domain: 'backend', description: 'JSON Web Tokens' },
  { slug: 'refresh-tokens', name: 'Refresh Tokens', domain: 'backend', description: 'Refresh token rotation and storage' },
  { slug: 'oauth', name: 'OAuth', domain: 'backend', description: 'OAuth 2.0 authorization flows' },
  { slug: 'oidc', name: 'OIDC', domain: 'backend', description: 'OpenID Connect identity layer' },
  { slug: 'authorization', name: 'Authorization', domain: 'backend', description: 'RBAC/ABAC and permissions' },
  // Frontend depth
  { slug: 'react-reconciliation', name: 'React Reconciliation', domain: 'frontend', description: 'Diffing, keys, and commit phase' },
  { slug: 'react-hooks', name: 'React Hooks', domain: 'frontend', description: 'useState, useEffect, custom hooks' },
  { slug: 'state-management', name: 'State Management', domain: 'frontend', description: 'Local vs global client state' },
  { slug: 'http-caching', name: 'HTTP Caching', domain: 'frontend', description: 'Cache-Control, ETag, conditional requests' },
  // MERN / Node
  { slug: 'express', name: 'Express', domain: 'backend', description: 'Express middleware and routing' },
  { slug: 'mongodb', name: 'MongoDB', domain: 'databases', description: 'Document model and aggregation' },
  { slug: 'mongoose', name: 'Mongoose', domain: 'databases', description: 'ODM schemas and middleware' },
  // Android
  { slug: 'android', name: 'Android', domain: 'android', description: 'Android platform fundamentals' },
  { slug: 'kotlin', name: 'Kotlin', domain: 'android', description: 'Kotlin language for Android' },
  { slug: 'android-lifecycle', name: 'Activity Lifecycle', domain: 'android', description: 'Activity/Fragment lifecycle' },
  { slug: 'jetpack-compose', name: 'Jetpack Compose', domain: 'android', description: 'Declarative UI on Android' },
  { slug: 'android-networking', name: 'Android Networking', domain: 'android', description: 'Retrofit/OkHttp and threading' },
  { slug: 'room-db', name: 'Room', domain: 'android', description: 'Local persistence with Room' },
  { slug: 'coroutines', name: 'Coroutines', domain: 'android', description: 'Kotlin coroutines and Flow' },
  { slug: 'android-architecture', name: 'Android Architecture', domain: 'android', description: 'MVVM, Clean Architecture' },
  // Data analyst
  { slug: 'data-analyst', name: 'Data Analysis', domain: 'data', description: 'Analysis fundamentals' },
  { slug: 'excel-analytics', name: 'Excel / Spreadsheets', domain: 'data', description: 'Pivot tables and spreadsheet analysis' },
  { slug: 'python-pandas', name: 'Pandas', domain: 'data', description: 'DataFrames and wrangling' },
  { slug: 'statistics-basics', name: 'Statistics Basics', domain: 'data', description: 'Distributions, significance, bias' },
  { slug: 'data-visualization', name: 'Data Visualization', domain: 'data', description: 'Charts and dashboard design' },
  { slug: 'sql-analytics', name: 'SQL for Analytics', domain: 'data', description: 'Window functions and analytical SQL' },
  { slug: 'etl-basics', name: 'ETL Basics', domain: 'data', description: 'Extract, transform, load pipelines' },
  { slug: 'ab-testing', name: 'A/B Testing', domain: 'data', description: 'Experiment design and interpretation' },
  { slug: 'metrics-kpis', name: 'Metrics & KPIs', domain: 'data', description: 'North-star and operational metrics' },
];

/**
 * @typedef {{ slug: string, name: string, description?: string, importance: number, concepts: { slug: string, difficultyBand?: string, isCore?: boolean }[] }} CompetencyDef
 * @typedef {{ roleSlug: string, displayName: string, summary: string, aliases?: string[], competencies: CompetencyDef[] }} RoleDef
 */

/** @type {RoleDef[]} */
export const roleCurricula = [
  {
    roleSlug: 'backend-engineer',
    displayName: 'Backend Engineer',
    summary: 'APIs, data, auth, caching, reliability, and production thinking for server-side roles.',
    aliases: ['backend', 'backend developer', 'backend engineer', 'node backend', 'java backend', 'api developer'],
    competencies: [
      {
        slug: 'authentication',
        name: 'Authentication & Authorization',
        importance: 0.9,
        concepts: [
          { slug: 'auth', difficultyBand: 'easy' },
          { slug: 'sessions', difficultyBand: 'easy' },
          { slug: 'jwt', difficultyBand: 'medium' },
          { slug: 'refresh-tokens', difficultyBand: 'medium' },
          { slug: 'oauth', difficultyBand: 'hard' },
          { slug: 'authorization', difficultyBand: 'medium' },
        ],
      },
      {
        slug: 'databases',
        name: 'Databases',
        importance: 0.9,
        concepts: [
          { slug: 'sql', difficultyBand: 'easy' },
          { slug: 'indexing', difficultyBand: 'medium' },
          { slug: 'transactions', difficultyBand: 'medium' },
          { slug: 'normalization', difficultyBand: 'medium' },
          { slug: 'nosql', difficultyBand: 'medium' },
          { slug: 'sharding', difficultyBand: 'hard' },
        ],
      },
      {
        slug: 'caching',
        name: 'Caching',
        importance: 0.75,
        concepts: [
          { slug: 'redis', difficultyBand: 'easy' },
          { slug: 'ttl', difficultyBand: 'medium' },
          { slug: 'cache-invalidation', difficultyBand: 'medium' },
          { slug: 'eviction', difficultyBand: 'hard' },
        ],
      },
      {
        slug: 'apis',
        name: 'API Design',
        importance: 0.85,
        concepts: [
          { slug: 'rest-apis', difficultyBand: 'easy' },
          { slug: 'api-design', difficultyBand: 'medium' },
          { slug: 'nodejs', difficultyBand: 'easy' },
        ],
      },
      {
        slug: 'production',
        name: 'Production & Security',
        importance: 0.8,
        concepts: [
          { slug: 'security', difficultyBand: 'medium' },
          { slug: 'observability', difficultyBand: 'medium' },
          { slug: 'concurrency', difficultyBand: 'hard' },
        ],
      },
      {
        slug: 'architecture',
        name: 'System Design Basics',
        importance: 0.7,
        concepts: [
          { slug: 'scalability', difficultyBand: 'medium' },
          { slug: 'load-balancing', difficultyBand: 'medium' },
          { slug: 'message-queues', difficultyBand: 'hard' },
          { slug: 'consistency', difficultyBand: 'hard' },
        ],
      },
    ],
  },
  {
    roleSlug: 'frontend-engineer',
    displayName: 'Frontend Engineer',
    summary: 'JavaScript runtime, React, browser performance, accessibility, and UI fundamentals.',
    aliases: ['frontend', 'frontend developer', 'frontend engineer', 'ui developer', 'react developer', 'react'],
    competencies: [
      {
        slug: 'javascript',
        name: 'JavaScript Fundamentals',
        importance: 0.95,
        concepts: [
          { slug: 'javascript', difficultyBand: 'easy' },
          { slug: 'event-loop', difficultyBand: 'medium' },
        ],
      },
      {
        slug: 'react',
        name: 'React',
        importance: 0.9,
        concepts: [
          { slug: 'react', difficultyBand: 'easy' },
          { slug: 'react-reconciliation', difficultyBand: 'medium' },
          { slug: 'react-hooks', difficultyBand: 'medium' },
          { slug: 'state-management', difficultyBand: 'hard' },
        ],
      },
      {
        slug: 'browser',
        name: 'Browser & CSS',
        importance: 0.8,
        concepts: [
          { slug: 'css-layout', difficultyBand: 'easy' },
          { slug: 'browser-performance', difficultyBand: 'medium' },
          { slug: 'accessibility', difficultyBand: 'medium' },
          { slug: 'http-caching', difficultyBand: 'medium' },
        ],
      },
      {
        slug: 'web-security',
        name: 'Web Security',
        importance: 0.7,
        concepts: [{ slug: 'security', difficultyBand: 'medium' }],
      },
      {
        slug: 'behavioral',
        name: 'Collaboration',
        importance: 0.5,
        concepts: [
          { slug: 'star-method', difficultyBand: 'easy' },
          { slug: 'ownership', difficultyBand: 'medium' },
        ],
      },
    ],
  },
  {
    roleSlug: 'mern-stack',
    displayName: 'MERN / Full-Stack',
    summary: 'MongoDB, Express, React, Node — full-stack fundamentals for product engineering interviews.',
    aliases: [
      'mern',
      'mern stack',
      'mern stack developer',
      'full stack',
      'fullstack',
      'full-stack developer',
      'full stack developer',
    ],
    competencies: [
      {
        slug: 'react-ui',
        name: 'React & Frontend',
        importance: 0.85,
        concepts: [
          { slug: 'javascript', difficultyBand: 'easy' },
          { slug: 'react', difficultyBand: 'easy' },
          { slug: 'react-reconciliation', difficultyBand: 'medium' },
          { slug: 'react-hooks', difficultyBand: 'medium' },
        ],
      },
      {
        slug: 'node-express',
        name: 'Node & Express',
        importance: 0.85,
        concepts: [
          { slug: 'nodejs', difficultyBand: 'easy' },
          { slug: 'express', difficultyBand: 'easy' },
          { slug: 'rest-apis', difficultyBand: 'medium' },
          { slug: 'event-loop', difficultyBand: 'medium' },
        ],
      },
      {
        slug: 'mongo',
        name: 'MongoDB',
        importance: 0.8,
        concepts: [
          { slug: 'mongodb', difficultyBand: 'easy' },
          { slug: 'mongoose', difficultyBand: 'medium' },
          { slug: 'nosql', difficultyBand: 'medium' },
          { slug: 'indexing', difficultyBand: 'medium' },
        ],
      },
      {
        slug: 'auth',
        name: 'Auth',
        importance: 0.85,
        concepts: [
          { slug: 'auth', difficultyBand: 'easy' },
          { slug: 'jwt', difficultyBand: 'medium' },
          { slug: 'refresh-tokens', difficultyBand: 'hard' },
        ],
      },
      {
        slug: 'caching-ops',
        name: 'Caching & Ops',
        importance: 0.65,
        concepts: [
          { slug: 'redis', difficultyBand: 'medium' },
          { slug: 'security', difficultyBand: 'medium' },
          { slug: 'observability', difficultyBand: 'medium' },
        ],
      },
    ],
  },
  {
    roleSlug: 'android-developer',
    displayName: 'Android Developer',
    summary: 'Kotlin, lifecycle, Compose, local data, networking, and app architecture for Android interviews.',
    aliases: ['android', 'android developer', 'android engineer', 'kotlin android', 'mobile android'],
    competencies: [
      {
        slug: 'kotlin-core',
        name: 'Kotlin & Platform',
        importance: 0.9,
        concepts: [
          { slug: 'kotlin', difficultyBand: 'easy' },
          { slug: 'android', difficultyBand: 'easy' },
          { slug: 'coroutines', difficultyBand: 'medium' },
        ],
      },
      {
        slug: 'ui-lifecycle',
        name: 'UI & Lifecycle',
        importance: 0.9,
        concepts: [
          { slug: 'android-lifecycle', difficultyBand: 'easy' },
          { slug: 'jetpack-compose', difficultyBand: 'medium' },
        ],
      },
      {
        slug: 'data-network',
        name: 'Data & Networking',
        importance: 0.85,
        concepts: [
          { slug: 'room-db', difficultyBand: 'medium' },
          { slug: 'android-networking', difficultyBand: 'medium' },
        ],
      },
      {
        slug: 'architecture',
        name: 'App Architecture',
        importance: 0.8,
        concepts: [{ slug: 'android-architecture', difficultyBand: 'medium' }],
      },
      {
        slug: 'behavioral',
        name: 'Behavioral',
        importance: 0.5,
        concepts: [
          { slug: 'star-method', difficultyBand: 'easy' },
          { slug: 'ownership', difficultyBand: 'medium' },
        ],
      },
    ],
  },
  {
    roleSlug: 'data-analyst',
    displayName: 'Data Analyst',
    summary: 'SQL analytics, statistics, visualization, experimentation, and business metrics.',
    aliases: ['data analyst', 'business analyst', 'analytics', 'bi analyst', 'data analytics'],
    competencies: [
      {
        slug: 'sql',
        name: 'SQL & Data',
        importance: 0.95,
        concepts: [
          { slug: 'sql', difficultyBand: 'easy' },
          { slug: 'sql-analytics', difficultyBand: 'medium' },
          { slug: 'indexing', difficultyBand: 'medium' },
        ],
      },
      {
        slug: 'stats',
        name: 'Statistics & Experiments',
        importance: 0.85,
        concepts: [
          { slug: 'statistics-basics', difficultyBand: 'easy' },
          { slug: 'ab-testing', difficultyBand: 'medium' },
          { slug: 'metrics-kpis', difficultyBand: 'medium' },
        ],
      },
      {
        slug: 'tooling',
        name: 'Analysis Tooling',
        importance: 0.8,
        concepts: [
          { slug: 'excel-analytics', difficultyBand: 'easy' },
          { slug: 'python-pandas', difficultyBand: 'medium' },
          { slug: 'data-visualization', difficultyBand: 'medium' },
        ],
      },
      {
        slug: 'pipelines',
        name: 'Data Pipelines',
        importance: 0.65,
        concepts: [{ slug: 'etl-basics', difficultyBand: 'medium' }],
      },
      {
        slug: 'behavioral',
        name: 'Stakeholder Communication',
        importance: 0.55,
        concepts: [
          { slug: 'star-method', difficultyBand: 'easy' },
          { slug: 'ownership', difficultyBand: 'medium' },
        ],
      },
    ],
  },
];

/** Flatten aliases → roleSlug for targetRole normalization */
export function buildRoleAliasMap(curricula = roleCurricula) {
  const map = new Map();
  for (const role of curricula) {
    map.set(role.roleSlug, role.roleSlug);
    map.set(role.displayName.toLowerCase(), role.roleSlug);
    for (const alias of role.aliases || []) {
      map.set(String(alias).trim().toLowerCase(), role.roleSlug);
    }
  }
  return map;
}
