const BANK = {
  technical: [
    'Walk me through how you would debug a production issue where users report intermittent API timeouts.',
    'Explain the difference between authentication and authorization with a real example from your work.',
    'How would you design pagination for a large list API, and what tradeoffs would you consider?',
    'What happens in the browser from the moment a user clicks a link to the page becoming interactive?',
    'Tell me about a time you had to choose between two technical approaches — how did you decide?',
  ],
  behavioral: [
    'Tell me about a time you disagreed with a teammate. How did you handle it, and what was the outcome?',
    'Describe a project that did not go as planned. What did you do, and what did you learn?',
    'Give an example of when you took ownership beyond your assigned tasks.',
    'Tell me about feedback you received that was hard to hear. How did you respond?',
    'Describe a time you had to learn something quickly under pressure.',
  ],
  coding: [
    'Write a function that returns the first non-repeating character in a string. Explain your approach and complexity.',
    'Implement a function to merge two sorted arrays into one sorted array without using a sort helper.',
    'Given an array of integers, return indices of the two numbers that add up to a target. Walk through edge cases.',
    'Write a function that checks whether a string of brackets is balanced. Explain your data structure choice.',
    'Implement debounce in JavaScript and explain when you would use it in a UI.',
  ],
  'system-design': [
    'Design a URL shortener. Cover API, storage, and how you would handle high read traffic.',
    'How would you design a notification system that supports email, push, and in-app messages?',
    'Design a simple news feed. What data model and fan-out strategy would you choose and why?',
    'How would you design rate limiting for a public API used by many clients?',
    'Design file upload for a web app that must support large videos reliably.',
  ],
};

const WEAK_PROBE = [
  'Let us go deeper on a weak area from your past sessions: explain {topic} as if you were teaching a junior engineer.',
  'I want to pressure-test {topic}. What are common mistakes candidates make here, and how do you avoid them?',
  'Give a practical example where {topic} mattered in a real project or production system.',
];

export function fallbackQuestion({ mode, index = 0, weakTopic = null, interviewLanguage = 'english' }) {
  if (weakTopic) {
    const template = WEAK_PROBE[index % WEAK_PROBE.length];
    const q = template.replace(/\{topic\}/g, weakTopic);
    return localizeFallback(q, interviewLanguage);
  }
  const list = BANK[mode] || BANK.technical;
  return localizeFallback(list[index % list.length], interviewLanguage);
}

function localizeFallback(question, interviewLanguage) {
  const lang = String(interviewLanguage || 'english').toLowerCase();
  if (lang === 'hindi') {
    return `${question}\n\n(कृपया हिंदी में उत्तर दीजिए — technical terms English में ठीक हैं।)`;
  }
  if (lang === 'hinglish') {
    return `${question}\n\n(Hinglish mein answer kar sakte ho — clear aur structured rakho.)`;
  }
  return question;
}

export function curriculumTopicList(curriculum) {
  if (!curriculum || typeof curriculum !== 'object') return [];
  return [
    ...(curriculum.coreTopics || []),
    ...(curriculum.advancedTopics || []),
    ...(curriculum.trickTopics || []),
    ...(curriculum.recruiterTopics || []),
  ]
    .map((t) => String(t).trim())
    .filter(Boolean);
}
