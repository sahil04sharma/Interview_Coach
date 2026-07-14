import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const companyStyles = [
  {
    name: 'general',
    styleNotes:
      'This is an all-around interview practice style, not tied to one company. Cover fundamentals that transfer everywhere: clear communication, structured thinking, depth on claimed skills, and honest trade-offs. Difficulty should match the candidate level. Mix breadth and follow-ups on weak topics. Tone is professional, fair, and strict — help them improve for any interview, not one brand.',
  },
  {
    name: 'google',
    styleNotes:
      'Google interviews emphasize fundamentals, clarity of thought, and structured problem solving. Expect deep follow-ups that probe trade-offs and edge cases. Difficulty is high; vague answers get pushed hard. Tone is professional, curious, and exacting.',
  },
  {
    name: 'meta',
    styleNotes:
      'Meta interviews favor product sense, shipping speed, and concrete impact stories. Follow-ups dig into metrics, ownership, and how you handled ambiguity. Difficulty is high with a collaborative but intense tone. Prefer specifics over theory.',
  },
  {
    name: 'amazon',
    styleNotes:
      'Amazon interviews are Leadership Principles driven with a strong bias for customer obsession and ownership. Expect behavioral depth plus practical technical questions. Follow-ups demand STAR structure and measurable outcomes. Tone is direct and bar-raising.',
  },
  {
    name: 'tcs',
    styleNotes:
      'TCS interviews focus on core CS fundamentals, communication clarity, and willingness to work in delivery-oriented teams. Difficulty is moderate; expect process-aware questions and scenario-based checks. Tone is formal and structured. Follow-ups are lighter than FAANG but still expect clear basics.',
  },
  {
    name: 'infosys',
    styleNotes:
      'Infosys interviews emphasize fundamentals, coding basics, and clarity of communication for client-facing delivery roles. Difficulty is moderate with questions on concepts, projects, and adaptability. Tone is polite and formal. Follow-ups check confidence and consistency more than deep system design.',
  },
  {
    name: 'startup',
    styleNotes:
      'Startup interviews value practical ownership, speed, and ability to wear multiple hats. Difficulty varies but expect hands-on problem solving and trade-offs under constraints. Follow-ups dig into what you built end-to-end. Tone is informal, fast, and results-oriented.',
  },
];

async function main() {
  for (const style of companyStyles) {
    await prisma.companyStyle.upsert({
      where: { name: style.name },
      update: { styleNotes: style.styleNotes },
      create: style,
    });
  }

  console.log(`Seeded ${companyStyles.length} company styles.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
