/**
 * Curated ConceptEdge seed data for core interview domains.
 * Slugs must match server/prisma/seed.js concept tree.
 *
 * Edge direction: prerequisite(from -> to) means understanding `to` requires `from`.
 */
export const conceptEdges = [
  // Caching / Redis
  { fromSlug: 'caching', toSlug: 'redis', type: 'prerequisite', weight: 0.7 },
  { fromSlug: 'redis', toSlug: 'ttl', type: 'prerequisite', weight: 0.6 },
  { fromSlug: 'redis', toSlug: 'eviction', type: 'prerequisite', weight: 0.65 },
  { fromSlug: 'redis', toSlug: 'persistence', type: 'prerequisite', weight: 0.5 },
  { fromSlug: 'redis', toSlug: 'replication', type: 'prerequisite', weight: 0.55 },
  { fromSlug: 'replication', toSlug: 'redis-cluster', type: 'prerequisite', weight: 0.6 },
  { fromSlug: 'ttl', toSlug: 'eviction', type: 'commonly-confused-with', weight: 0.75 },
  { fromSlug: 'eviction', toSlug: 'cache-invalidation', type: 'related', weight: 0.6 },
  { fromSlug: 'cdn-caching', toSlug: 'cache-invalidation', type: 'related', weight: 0.55 },

  // Databases
  { fromSlug: 'sql', toSlug: 'indexing', type: 'prerequisite', weight: 0.7 },
  { fromSlug: 'sql', toSlug: 'transactions', type: 'prerequisite', weight: 0.65 },
  { fromSlug: 'sql', toSlug: 'normalization', type: 'prerequisite', weight: 0.55 },
  { fromSlug: 'indexing', toSlug: 'sharding', type: 'prerequisite', weight: 0.5 },
  { fromSlug: 'transactions', toSlug: 'consistency', type: 'related', weight: 0.6 },
  { fromSlug: 'nosql', toSlug: 'sharding', type: 'related', weight: 0.55 },
  { fromSlug: 'normalization', toSlug: 'indexing', type: 'commonly-confused-with', weight: 0.45 },

  // System design
  { fromSlug: 'scalability', toSlug: 'load-balancing', type: 'prerequisite', weight: 0.6 },
  { fromSlug: 'load-balancing', toSlug: 'microservices', type: 'prerequisite', weight: 0.55 },
  { fromSlug: 'message-queues', toSlug: 'microservices', type: 'related', weight: 0.6 },
  { fromSlug: 'consistency', toSlug: 'scalability', type: 'related', weight: 0.5 },
  { fromSlug: 'api-design', toSlug: 'rest-apis', type: 'related', weight: 0.65 },

  // Frontend / backend
  { fromSlug: 'javascript', toSlug: 'event-loop', type: 'prerequisite', weight: 0.7 },
  { fromSlug: 'javascript', toSlug: 'react', type: 'prerequisite', weight: 0.6 },
  { fromSlug: 'react', toSlug: 'browser-performance', type: 'related', weight: 0.45 },
  { fromSlug: 'nodejs', toSlug: 'concurrency', type: 'prerequisite', weight: 0.55 },
  { fromSlug: 'auth', toSlug: 'security', type: 'related', weight: 0.6 },
  { fromSlug: 'observability', toSlug: 'microservices', type: 'related', weight: 0.5 },

  // Behavioral
  { fromSlug: 'star-method', toSlug: 'ownership', type: 'related', weight: 0.5 },
  { fromSlug: 'leadership', toSlug: 'conflict', type: 'related', weight: 0.45 },
];
