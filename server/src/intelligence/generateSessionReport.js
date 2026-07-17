import { chatJson } from '../llm.js';
import { buildVerdictMessages } from '../prompts.js';
import { normalizeVerdict } from '../services/evaluationService.js';
import { runReportWriter } from './agents/reportWriter.js';
import { loadReportContext } from './reportContext.js';
import {
  mapReportWriterToVerdict,
  buildExplainableReportAnalysis,
} from './reportMapping.js';
import { isIntelligenceV2Enabled } from './cognitiveModel.js';

async function runV1Verdict({ company, session, questions }) {
  const raw = await chatJson({
    messages: buildVerdictMessages({
      companyName: company.name,
      questions,
      interviewLanguage: session.interviewLanguage || 'english',
    }),
    temperature: 0.3,
  });
  return raw;
}

/**
 * Generate session report at finish. V2: explainable Report Writer with evidence links.
 * Falls back to V1 buildVerdictMessages on failure or when flag is off.
 */
export async function generateSessionReport({ session, company, questions, overallScore }) {
  if (!isIntelligenceV2Enabled()) {
    const raw = await runV1Verdict({ company, session, questions });
    const verdict = normalizeVerdict(raw);
    return {
      verdict,
      reportAnalysis: buildExplainableReportAnalysis(verdict, { source: 'v1' }),
      intelligence: null,
    };
  }

  try {
    const reportContext = await loadReportContext(session, questions);
    const parsed = await runReportWriter({
      companyName: company.name,
      interviewLanguage: session.interviewLanguage || 'english',
      targetRole: session.user?.targetRole,
      reportContext,
      overallScore,
    });

    const mapped = mapReportWriterToVerdict(parsed);
    const verdict = normalizeVerdict(mapped);
    verdict.dimensionReport = mapped.dimensionReport;
    verdict.resolvedHypotheses = mapped.resolvedHypotheses;
    verdict.reportMisconceptions = mapped.reportMisconceptions;
    verdict.strengthsDetailed = mapped.strengthsDetailed;
    verdict.weaknessesDetailed = mapped.weaknessesDetailed;

    return {
      verdict,
      reportAnalysis: buildExplainableReportAnalysis(verdict, { source: 'v2-report-writer' }),
      intelligence: {
        source: 'v2-report-writer',
        dimensionCount: verdict.dimensionReport?.length || 0,
        resolvedHypothesisCount: verdict.resolvedHypotheses?.length || 0,
        misconceptionCount: verdict.reportMisconceptions?.length || 0,
        evidenceLinkedStrengths: verdict.strengthsDetailed?.length || 0,
        evidenceLinkedWeaknesses: verdict.weaknessesDetailed?.length || 0,
      },
    };
  } catch (err) {
    console.warn('[intelligence] report writer failed, using V1:', err.message);
    const raw = await runV1Verdict({ company, session, questions });
    const verdict = normalizeVerdict(raw);
    return {
      verdict,
      reportAnalysis: buildExplainableReportAnalysis(verdict, {
        source: 'v1-fallback',
        error: err.message,
      }),
      intelligence: { source: 'v1-fallback', error: err.message },
    };
  }
}
