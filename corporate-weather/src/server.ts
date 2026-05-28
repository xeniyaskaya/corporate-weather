import { McpServer } from "skybridge/server";
import { z } from "zod";

const countrySchema = z.enum(["DE", "US", "EU"]);
const scaleSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const riskCategorySchema = z.enum([
  "Market-Wide",
  "Leadership Language",
  "Employee Sentiment",
  "Hiring",
  "News",
  "German Legal Signal",
  "Official Layoff / Legal",
]);

const signalSchema = z.object({
  title: z.string(),
  category: riskCategorySchema,
  severity: scaleSchema,
  confidence: scaleSchema,
  recency: scaleSchema,
  evidence: z.string(),
  explanation: z.string(),
});

const calmSignalSchema = z.object({
  title: z.string(),
  impact: z.number().min(-20).max(0),
  evidence: z.string(),
  explanation: z.string(),
});

const scoreDetailsSchema = z.object({
  rawRiskScore: z.number().min(0).max(100),
  calmModifierTotal: z.number().min(-100).max(0),
  guardrailAdjustedScore: z.number().min(0).max(100),
  categoryContributions: z.array(
    z.object({
      category: z.string(),
      contribution: z.number().min(0).max(45),
      cap: z.number().min(0).max(45),
    }),
  ),
  increasedBy: z.array(z.string()),
  reducedBy: z.array(z.string()),
  whyNotHigher: z.array(z.string()),
});

const riskOutputSchema = {
  companyName: z.string(),
  riskScore: z.number().min(0).max(100),
  riskLevel: z.enum(["Clear", "Watchlist", "Cloudy", "Storm Warning"]),
  confidence: z.enum(["Low", "Medium", "High"]),
  summary: z.string(),
  signals: z.array(signalSchema),
  calmSignals: z.array(calmSignalSchema),
  missingEvidence: z.array(z.string()),
  watchNext: z.array(z.string()),
  scoreDetails: scoreDetailsSchema,
};

type Country = z.infer<typeof countrySchema>;
type Signal = z.infer<typeof signalSchema>;
type CalmSignal = z.infer<typeof calmSignalSchema>;
type RiskLevel = z.infer<typeof riskOutputSchema.riskLevel>;
type Confidence = z.infer<typeof riskOutputSchema.confidence>;
type SignalScale = Signal["severity"];
type RiskCategory = Signal["category"];
type ScoreDetails = z.infer<typeof scoreDetailsSchema>;
type RiskOutput = {
  companyName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  confidence: Confidence;
  summary: string;
  signals: Signal[];
  calmSignals: CalmSignal[];
  missingEvidence: string[];
  watchNext: string[];
  scoreDetails: ScoreDetails;
};

const highRiskGermanTerms = [
  "Sozialplan",
  "Interessenausgleich",
  "Massenentlassungsanzeige",
  "Betriebsrat",
  "betriebsbedingte Kündigungen",
  "Standortschließung",
  "Stellenabbau",
];

const newsTerms = [
  "layoffs",
  "restructuring",
  "hiring freeze",
  "Sozialplan",
  "Stellenabbau",
  "Restrukturierung",
];

const categoryCaps: Record<RiskCategory, number> = {
  "Market-Wide": 8,
  "Leadership Language": 12,
  "Employee Sentiment": 15,
  Hiring: 20,
  News: 20,
  "German Legal Signal": 45,
  "Official Layoff / Legal": 45,
};

function hashCompany(companyName: string) {
  return [...companyName.toLowerCase()].reduce(
    (hash, char) => (hash * 31 + char.charCodeAt(0)) % 997,
    17,
  );
}

function riskLevelFor(score: number): RiskLevel {
  if (score >= 76) return "Storm Warning";
  if (score >= 51) return "Cloudy";
  if (score >= 26) return "Watchlist";
  return "Clear";
}

function signalScore(signal: Signal) {
  return signal.severity * signal.confidence * signal.recency;
}

function signal(
  title: string,
  category: RiskCategory,
  severity: SignalScale,
  confidence: SignalScale,
  recency: SignalScale,
  evidence: string,
  explanation: string,
): Signal {
  return { title, category, severity, confidence, recency, evidence, explanation };
}

function calmSignal(
  title: string,
  impact: number,
  evidence: string,
  explanation: string,
): CalmSignal {
  return { title, impact, evidence, explanation };
}

function isGenericSignal(signal: Signal) {
  return (
    signal.category === "Market-Wide" ||
    (signal.category === "Leadership Language" && signal.severity <= 1)
  );
}

function isCompanySpecificSignal(signal: Signal) {
  return signal.category !== "Market-Wide" && signal.confidence >= 3 && signal.severity >= 2;
}

function isHighConfidenceCompanySignal(signal: Signal) {
  return isCompanySpecificSignal(signal) && signal.confidence >= 4;
}

function isHighOrCritical(signal: Signal) {
  return signal.severity >= 4 && signal.confidence >= 4;
}

function isConfirmedFormalSignal(signal: Signal) {
  return (
    signal.confidence >= 4 &&
    signal.severity >= 4 &&
    (signal.category === "German Legal Signal" ||
      signal.category === "Official Layoff / Legal" ||
      /sozialplan|interessenausgleich|massenentlassung|standortschließung|stellenabbau|confirmed layoff/i.test(
        signal.title,
      ))
  );
}

function confidenceFor(signals: Signal[], missingEvidence: string[]): Confidence {
  if (signals.some(isConfirmedFormalSignal) && missingEvidence.length <= 2) return "High";

  const companySignals = signals.filter(isCompanySpecificSignal);
  const averageConfidence =
    companySignals.reduce((total, signal) => total + signal.confidence, 0) /
    Math.max(1, companySignals.length);

  if (averageConfidence >= 4 && missingEvidence.length <= 2) return "High";
  if (averageConfidence >= 3 && missingEvidence.length <= 4) return "Medium";
  return "Low";
}

function calculateScore(signals: Signal[], calmSignals: CalmSignal[]): ScoreDetails {
  const categoryTotals = new Map<RiskCategory, number>();
  const severityWeight: Record<SignalScale, number> = {
    1: 0.9,
    2: 0.95,
    3: 1,
    4: 1,
    5: 1,
  };
  const confidenceWeight: Record<SignalScale, number> = {
    1: 0.45,
    2: 0.6,
    3: 0.75,
    4: 0.9,
    5: 1,
  };
  const recencyWeight: Record<SignalScale, number> = {
    1: 0.5,
    2: 0.65,
    3: 0.8,
    4: 0.9,
    5: 1,
  };

  for (const riskSignal of signals) {
    const cap = categoryCaps[riskSignal.category];
    const contribution =
      severityWeight[riskSignal.severity] *
      confidenceWeight[riskSignal.confidence] *
      recencyWeight[riskSignal.recency] *
      cap;
    categoryTotals.set(
      riskSignal.category,
      Math.min(cap, (categoryTotals.get(riskSignal.category) ?? 0) + contribution),
    );
  }

  const categoryContributions = [...categoryTotals.entries()].map(([category, contribution]) => ({
    category,
    contribution: Math.round(contribution),
    cap: categoryCaps[category],
  }));
  const baseline = signals.length > 0 ? 25 : 0;
  const rawRiskScore = Math.min(
    100,
    Math.round(
      baseline + categoryContributions.reduce((total, item) => total + item.contribution, 0),
    ),
  );

  const requestedCalmModifierTotal = calmSignals.reduce((total, item) => total + item.impact, 0);
  const maxCalmReduction = Math.round(rawRiskScore * 0.25);
  const calmModifierTotal = -Math.min(Math.abs(requestedCalmModifierTotal), maxCalmReduction);
  let guardrailAdjustedScore = Math.max(0, Math.min(100, rawRiskScore + calmModifierTotal));

  const onlyGenericSignals = signals.length > 0 && signals.every(isGenericSignal);
  const hasCompanySpecificSignal = signals.some(isCompanySpecificSignal);
  const hasHighConfidenceCompanySignal = signals.some(isHighConfidenceCompanySignal);
  const hasHighOrCriticalSignal = signals.some(isHighOrCritical);
  const hasConfirmedFormalSignal = signals.some(isConfirmedFormalSignal);
  const whyNotHigher: string[] = [];

  if (onlyGenericSignals && guardrailAdjustedScore > 50) {
    guardrailAdjustedScore = 50;
    whyNotHigher.push(
      "Score is capped at Watchlist because only generic market-wide or vague leadership signals were found.",
    );
  }

  if (!hasCompanySpecificSignal && guardrailAdjustedScore > 60) {
    guardrailAdjustedScore = 60;
    whyNotHigher.push(
      "Score cannot rise above Cloudy without at least one credible company-specific signal.",
    );
  }

  if (!hasHighConfidenceCompanySignal && guardrailAdjustedScore > 60) {
    guardrailAdjustedScore = 60;
    whyNotHigher.push(
      "Score is limited by missing medium or high-confidence company-specific evidence.",
    );
  }

  if (!hasHighOrCriticalSignal && guardrailAdjustedScore > 75) {
    guardrailAdjustedScore = 75;
    whyNotHigher.push(
      "Storm Warning requires at least one high or critical signal with confidence 4 or 5.",
    );
  }

  if (!hasConfirmedFormalSignal && guardrailAdjustedScore > 85) {
    guardrailAdjustedScore = 85;
    whyNotHigher.push(
      "Score cannot exceed 85 without confirmed layoffs, Sozialplan, Interessenausgleich, Massenentlassung, or Standortschließung.",
    );
  }

  if (hasConfirmedFormalSignal && guardrailAdjustedScore > 95) {
    guardrailAdjustedScore = 95;
  }

  if (!hasConfirmedFormalSignal) {
    whyNotHigher.push(
      "No confirmed Stellenabbau, Sozialplan, Interessenausgleich, Massenentlassung, or Standortschließung was found.",
    );
  }

  return {
    rawRiskScore,
    calmModifierTotal,
    guardrailAdjustedScore: Math.round(guardrailAdjustedScore),
    categoryContributions,
    increasedBy: signals.map(
      (item) =>
        `${item.title}: ${item.category} signal scored ${signalScore(item)} before category caps.`,
    ),
    reducedBy: calmSignals.map((item) => `${item.title}: ${item.impact} possible points.`),
    whyNotHigher,
  };
}

function buildSummary(
  companyName: string,
  riskLevel: RiskLevel,
  confidence: Confidence,
) {
  if (riskLevel === "Clear") {
    return `${companyName} shows limited visible layoff-risk signals. The score is reduced by calm signals and missing formal layoff evidence.`;
  }

  if (riskLevel === "Watchlist") {
    return `${companyName} is Watchlist, not Cloudy, because visible signals remain limited by missing high-confidence layoff, Stellenabbau, Sozialplan, or Standortschließung evidence.`;
  }

  if (riskLevel === "Cloudy") {
    return `${companyName} is Cloudy based on visible risk signals, but it is not Storm Warning because formal layoff or German legal-process evidence is still missing. Confidence is ${confidence.toLowerCase()}.`;
  }

  return `${companyName} is Storm Warning because high-confidence formal layoff or German legal-process signals are visible. This is signal analysis only, not a prediction.`;
}

function buildRiskOutput(
  companyName: string,
  signals: Signal[],
  calmSignals: CalmSignal[],
  missingEvidence: string[],
  watchNext: string[],
  summary?: string,
): RiskOutput {
  const scoreDetails = calculateScore(signals, calmSignals);
  const riskScore = scoreDetails.guardrailAdjustedScore;
  const riskLevel = riskLevelFor(riskScore);
  const confidence = confidenceFor(signals, missingEvidence);

  return {
    companyName,
    riskScore,
    riskLevel,
    confidence,
    summary: summary ?? buildSummary(companyName, riskLevel, confidence),
    signals,
    calmSignals,
    missingEvidence,
    watchNext,
    scoreDetails,
  };
}

const healthyDemoData = buildRiskOutput(
  "DemoSoft",
  [
    signal(
      "Generic market caution",
      "Market-Wide",
      1,
      2,
      4,
      "The demo scan sees broad market slowdown language in the sector, not a company-specific layoff signal.",
      "Market-wide pressure is a weak signal and is capped so it cannot dominate the workplace weather report.",
    ),
  ],
  [
    calmSignal(
      "Active hiring across departments",
      -10,
      "Open roles remain visible across product, engineering, customer success, and operations.",
      "Broad hiring is a calm signal because it lowers the likelihood that the visible public picture is dominated by cuts.",
    ),
    calmSignal(
      "Product and engineering hiring still active",
      -6,
      "The demo careers page includes product and engineering openings.",
      "Active technical hiring reduces concern about an immediate broad hiring freeze.",
    ),
    calmSignal(
      "Recent product launch",
      -8,
      "The demo story includes a recent product launch and growth-oriented customer messaging.",
      "Growth announcements are not proof of safety, but they are calm counter-signals.",
    ),
    calmSignal(
      "No formal layoff signal found",
      -12,
      "No confirmed layoff, hiring freeze, Stellenabbau, Sozialplan, or Standortschließung signal is present.",
      "Missing formal layoff evidence keeps the score low.",
    ),
  ],
  [
    "No German legal layoff terms were found.",
    "No confirmed hiring freeze or Stellenabbau was found.",
  ],
  [
    "Watch whether hiring remains active across several departments.",
    "Monitor for any shift from growth language to efficiency or profitability language tied to headcount.",
    "Re-check for formal layoff terms if new restructuring news appears.",
  ],
  "DemoSoft is Clear: visible risk signals are weak and outweighed by active hiring, product hiring, and no formal layoff evidence.",
);

const concernedDemoData = buildRiskOutput(
  "ScaleNow",
  [
    signal(
      "Market slowdown context",
      "Market-Wide",
      1,
      2,
      4,
      "Demo source data shows broad market slowdown and AI productivity pressure in the sector.",
      "This adds context, but it is intentionally capped because it is not company-specific layoff evidence.",
    ),
    signal(
      "Efficiency and profitability language",
      "Leadership Language",
      1,
      3,
      4,
      "Demo leadership language mentions efficiency, focus, and profitability without referencing cuts.",
      "This is a weak signal: it may indicate cost discipline, but it is too generic to imply layoffs.",
    ),
    signal(
      "Slower hiring",
      "Hiring",
      2,
      3,
      4,
      "Demo careers data shows fewer openings than before, but no confirmed hiring freeze.",
      "Slower hiring is a medium-low signal and should land in Watchlist unless corroborated by stronger evidence.",
    ),
    signal(
      "Some employee uncertainty",
      "Employee Sentiment",
      3,
      2,
      3,
      "Demo sentiment snippets mention uncertainty and unclear priorities.",
      "Employee sentiment is useful context, but this is lower confidence because it is subjective and not formal evidence.",
    ),
  ],
  [
    calmSignal(
      "No formal layoff signal found",
      -12,
      "No confirmed layoffs, Stellenabbau, Sozialplan, or Standortschließung were found.",
      "Without formal layoff evidence, the score should stay below Cloudy or near the low end of Cloudy.",
    ),
    calmSignal(
      "No confirmed Stellenabbau or Sozialplan",
      -10,
      "The demo scan does not contain German legal-process terms.",
      "Missing German legal-process evidence reduces the score.",
    ),
  ],
  [
    "No confirmed layoffs were found.",
    "No Sozialplan, Interessenausgleich, Massenentlassungsanzeige, or Standortschließung was found.",
  ],
  [
    "Watch for a confirmed hiring freeze.",
    "Watch whether efficiency language becomes linked to headcount or department consolidation.",
    "Monitor employee sentiment for repeated reorg or budget-cut language.",
  ],
  "ScaleNow is Watchlist, not Cloudy, because the scan found slower hiring and generic efficiency language, but no confirmed layoffs, Stellenabbau, Sozialplan, or Standortschließung.",
);

const cloudyDemoData = buildRiskOutput(
  "BudgetCloud",
  [
    signal(
      "Profitability discipline language",
      "Leadership Language",
      1,
      3,
      4,
      "Demo leadership language mentions profitability discipline and tighter investment focus.",
      "This is weak by itself, but it adds context when paired with hiring freeze and budget-cut signals.",
    ),
    signal(
      "Hiring freeze reported",
      "Hiring",
      3,
      4,
      4,
      "Demo source data includes a credible report that most non-critical hiring is paused.",
      "A hiring freeze is a medium signal because it can precede restructuring, especially when paired with budget pressure.",
    ),
    signal(
      "Repeated reorgs",
      "Employee Sentiment",
      3,
      3,
      4,
      "Demo sentiment sources mention repeated reorgs and uncertainty across several teams.",
      "Repeated reorg language increases workplace weather risk, but it is not the same as confirmed layoffs.",
    ),
    signal(
      "Credible budget-cut reports",
      "News",
      3,
      4,
      4,
      "Demo news-style data references budget cuts and department consolidation, without a formal layoff process.",
      "Budget-cut reporting is company-specific and credible, but the risk remains below Storm Warning without formal layoff evidence.",
    ),
  ],
  [
    calmSignal(
      "No formal layoff process found",
      -12,
      "No confirmed Sozialplan, Interessenausgleich, Massenentlassungsanzeige, or Standortschließung is present.",
      "Missing formal process evidence limits the score below Storm Warning.",
    ),
  ],
  [
    "No confirmed Stellenabbau was found.",
    "No Sozialplan or Standortschließung was found.",
  ],
  [
    "Watch whether the hiring freeze becomes a confirmed workforce reduction.",
    "Monitor for Sozialplan, Betriebsrat, or Massenentlassungsanzeige language.",
    "Watch whether budget-cut reports become official company statements.",
  ],
  "BudgetCloud is Cloudy: the scan shows hiring freeze, repeated reorgs, and credible budget-cut reports, but no formal layoff process yet.",
);

const stormDemoData = buildRiskOutput(
  "FutureMobility",
  [
    signal(
      "Confirmed Stellenabbau",
      "Official Layoff / Legal",
      4,
      5,
      5,
      "Demo source data includes a confirmed Stellenabbau announcement.",
      "Confirmed workforce reduction is a high-severity public signal and can justify Storm Warning when recent and credible.",
    ),
    signal(
      "Sozialplan and Betriebsrat negotiations",
      "German Legal Signal",
      5,
      5,
      5,
      "Demo source data contains Sozialplan, Betriebsrat negotiations, and Interessenausgleich language.",
      "Formal German labor-process terms are critical because they indicate concrete workforce-reduction negotiations.",
    ),
    signal(
      "Standortschließung referenced",
      "German Legal Signal",
      5,
      4,
      4,
      "Demo reporting references a Standortschließung connected to the restructuring program.",
      "Site-closure language is a critical signal when connected to official restructuring or labor-process reporting.",
    ),
  ],
  [],
  [],
  [
    "Watch for Sozialplan timeline, affected locations, and confirmed headcount scope.",
    "Monitor Betriebsrat statements and official company updates.",
    "Track whether Standortschließung reporting becomes final and legally documented.",
  ],
  "FutureMobility is Storm Warning because confirmed Stellenabbau, Sozialplan or Betriebsrat involvement, and Standortschließung signals are visible.",
);

const demoCompanies: Record<string, RiskOutput> = {
  demosoft: healthyDemoData,
  healthycompany: healthyDemoData,
  scalenow: concernedDemoData,
  slightlyconcerned: concernedDemoData,
  budgetcloud: cloudyDemoData,
  cloudycompany: cloudyDemoData,
  futuremobility: stormDemoData,
  stormcompany: stormDemoData,
};

function addSignal(
  signals: Signal[],
  category: RiskCategory,
  title: string,
  severity: SignalScale,
  confidence: SignalScale,
  recency: SignalScale,
  evidence: string,
  explanation: string,
) {
  signals.push(signal(title, category, severity, confidence, recency, evidence, explanation));
}

function collectSignals(companyName: string, country: Country | undefined) {
  const normalizedCountry = country ?? "EU";
  const seed = hashCompany(`${companyName}:${normalizedCountry}`);
  const signals: Signal[] = [];
  const calmSignals: CalmSignal[] = [];
  const missingEvidence: string[] = [];

  const marketPressure = seed % 3;
  if (marketPressure > 0) {
    addSignal(
      signals,
      "Market-Wide",
      "Market slowdown or AI productivity pressure",
      1,
      2,
      4,
      `Simulated collector found broad market or AI productivity pressure while checking ${companyName}.`,
      "Market-wide signals are intentionally capped because they are not company-specific layoff evidence.",
    );
  }

  const newsPressure = seed % 5;
  if (newsPressure >= 3) {
    addSignal(
      signals,
      "News",
      "Restructuring language in coverage",
      2,
      3,
      3,
      `Simulated collector checked: ${newsTerms
        .map((term) => `"${companyName} ${term}"`)
        .join(", ")}.`,
      "Reorganization language matters, but without layoffs or formal process terms it remains medium-low severity.",
    );
  } else {
    missingEvidence.push(
      "No recent confirmed layoff or workforce-reduction news was found in the simulated pass.",
    );
  }

  const hiringPressure = (seed >> 2) % 4;
  if (hiringPressure === 0) {
    calmSignals.push(
      calmSignal(
        "Active hiring across multiple departments",
        -10,
        "Simulated careers data still shows hiring across several departments.",
        "Active cross-functional hiring reduces the score.",
      ),
      calmSignal(
        "Product or engineering hiring still active",
        -6,
        "Simulated careers data includes product or engineering roles.",
        "Technical hiring is a calm counter-signal against an immediate broad hiring freeze.",
      ),
    );
  } else if (hiringPressure === 1) {
    addSignal(
      signals,
      "Hiring",
      "Slower hiring",
      2,
      3,
      4,
      "Open roles appear narrower than usual, but no confirmed hiring freeze was found.",
      "Slower hiring is a medium-low signal and should not push the score into high risk by itself.",
    );
  } else {
    addSignal(
      signals,
      "Hiring",
      "Hiring slowdown pattern",
      2,
      3,
      4,
      "Few open roles are visible and some role families look absent.",
      "Hiring slowdown raises watchlist risk, but remains below Cloudy unless corroborated by stronger evidence.",
    );
  }

  const sentimentPressure = (seed >> 4) % 5;
  if (sentimentPressure <= 1) {
    missingEvidence.push("Employee sentiment sources are weak or unavailable in the simulated pass.");
  } else {
    addSignal(
      signals,
      "Employee Sentiment",
      sentimentPressure >= 4 ? "Repeated employee uncertainty" : "Some employee uncertainty",
      sentimentPressure >= 4 ? 3 : 2,
      sentimentPressure >= 4 ? 3 : 2,
      3,
      "Review-style language contains simulated mentions of uncertainty, poor communication, or reorg fatigue.",
      "Employee sentiment is a contextual signal and is kept lower confidence unless corroborated publicly.",
    );
  }

  const leadershipPressure = (seed >> 6) % 4;
  if (leadershipPressure > 0) {
    addSignal(
      signals,
      "Leadership Language",
      "Efficiency or profitability language",
      1,
      3,
      4,
      "Leadership-language scan flags focus, efficiency, profitability, or sustainable growth language.",
      "Generic efficiency language is deliberately low severity because it is common and not layoff evidence by itself.",
    );
  }

  const legalPressure = normalizedCountry === "DE" || normalizedCountry === "EU" ? (seed >> 8) % 6 : 0;
  if (legalPressure >= 5) {
    addSignal(
      signals,
      "German Legal Signal",
      "Confirmed Sozialplan or Interessenausgleich process",
      5,
      5,
      5,
      `Collector simulates hits around ${highRiskGermanTerms.join(", ")}.`,
      "Formal German legal-process language is critical because it points to visible workforce-reduction negotiations.",
    );
  } else {
    calmSignals.push(
      calmSignal(
        "No formal layoff signal found",
        -12,
        "No confirmed layoff, Sozialplan, Interessenausgleich, Massenentlassungsanzeige, or Standortschließung was found.",
        "Missing formal layoff evidence lowers the score.",
      ),
      calmSignal(
        "No confirmed Stellenabbau or Sozialplan",
        -10,
        "No confirmed Stellenabbau or Sozialplan was found in the simulated pass.",
        "This prevents generic pressure from becoming an alarmist score.",
      ),
    );
    missingEvidence.push(
      "No confirmed Stellenabbau, Sozialplan, Interessenausgleich, Massenentlassungsanzeige, or Standortschließung was found.",
    );
  }

  if (signals.length > 0 && signals.every((item) => item.category === "Market-Wide")) {
    calmSignals.push(
      calmSignal(
        "Only generic market signals found",
        -15,
        "The scan found only broad market or AI-productivity pressure.",
        "Generic market signals are not enough to classify a company as high risk.",
      ),
    );
  }

  return { signals, calmSignals, missingEvidence };
}

function liveAnalysis(companyName: string, country?: Country) {
  const { signals, calmSignals, missingEvidence } = collectSignals(companyName, country);
  return buildRiskOutput(companyName, signals, calmSignals, missingEvidence, [
    "Watch for confirmed hiring freeze language or sudden role removals.",
    "Monitor whether efficiency language becomes tied to headcount, consolidation, or budget cuts.",
    "Look for formal German signals: Sozialplan, Interessenausgleich, Massenentlassungsanzeige, Betriebsrat negotiations, Standortschließung, or confirmed Stellenabbau.",
    "Treat generic market pressure as context, not prediction.",
  ]);
}

function genericCloudyDemoData(companyName: string): RiskOutput {
  return buildRiskOutput(
    companyName,
    [
      signal(
        "Efficiency language detected",
        "Leadership Language",
        1,
        3,
        4,
        "Fallback data found generic efficiency and profitability language.",
        "This is deliberately low severity because it is not company-specific layoff evidence.",
      ),
      signal(
        "Hiring visibility limited",
        "Hiring",
        2,
        3,
        3,
        "Fallback data could not establish a broad current hiring footprint.",
        "Limited hiring visibility raises watchlist risk, but not high risk without stronger evidence.",
      ),
    ],
    [
      calmSignal(
        "No formal layoff signal found",
        -12,
        "Fallback data has no confirmed layoffs, Stellenabbau, Sozialplan, or Standortschließung.",
        "Missing formal evidence keeps the fallback report cautious.",
      ),
      calmSignal(
        "No confirmed Stellenabbau or Sozialplan",
        -10,
        "No German legal-process signal is available in the fallback path.",
        "This prevents generic weak signals from pushing the score too high.",
      ),
    ],
    [
      "Live analysis failed, so this result uses cautious fallback data.",
      "No verified German legal/process terms were available in the fallback path.",
    ],
    [
      "Watch for confirmed hiring freeze language or sudden role removals.",
      "Monitor leadership updates for profitability, streamlining, or leaner organization language tied to headcount.",
      "Re-run analysis when live sources are available.",
    ],
    `${companyName} is shown with cautious fallback data because live analysis was unavailable; risk remains limited by missing high-confidence signals.`,
  );
}

function normalizeDemoKey(companyName: string) {
  return companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function analyzeCompany(companyName: string, country?: Country): RiskOutput {
  const demoData = demoCompanies[normalizeDemoKey(companyName)];
  if (demoData) {
    return demoData;
  }

  try {
    return liveAnalysis(companyName, country);
  } catch {
    return genericCloudyDemoData(companyName);
  }
}

const server = new McpServer(
  {
    name: "Corporate Weather",
    version: "0.0.1",
  },
  { capabilities: {} },
).registerTool(
  {
    name: "analyzeCompanyLayoffRisk",
    title: "Analyze company layoff risk",
    description:
      "Analyze visible public layoff-risk signals and produce a cautious workplace weather report. This does not predict layoffs or provide legal advice.",
    inputSchema: {
      companyName: z.string().min(1).describe("Company name to analyze"),
      country: countrySchema.optional().describe("Optional country or region context"),
    },
    outputSchema: riskOutputSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
    view: {
      component: "risk-dashboard",
      description: "RiskDashboard",
      prefersBorder: true,
    },
    _meta: {
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Checking corporate weather",
      "openai/toolInvocation/invoked": "Corporate weather analyzed",
    },
  },
  async ({ companyName, country }) => {
    const structuredContent = analyzeCompany(companyName.trim(), country);

    return {
      structuredContent,
      _meta: {
        result: structuredContent,
      },
      content: [
        {
          type: "text",
          text: `${structuredContent.companyName}: ${structuredContent.riskLevel} (${structuredContent.riskScore}/100), confidence ${structuredContent.confidence}. Signal analysis only, not a prediction or legal advice.`,
        },
      ],
    };
  },
);

if (process.env.NODE_ENV === "production") {
  const { default: manifest } = await import("./vite-manifest.js");
  server.setViteManifest(manifest);
}

export default await server.run();

export type AppType = typeof server;
