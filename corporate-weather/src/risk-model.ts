import { z } from "zod";

const scaleSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const riskCategorySchema = z.enum([
  "Market Context",
  "Leadership Language",
  "Kununu",
  "Careers",
  "Company-Owned",
  "DACH Press",
]);

const signalSchema = z.object({
  title: z.string(),
  category: riskCategorySchema,
  severity: scaleSchema,
  confidence: scaleSchema,
  recency: scaleSchema,
  sourceReliability: scaleSchema,
  companySpecific: z.boolean(),
  evidence: z.string(),
  explanation: z.string(),
});

const calmSignalSchema = z.object({
  title: z.string(),
  impact: z.number().min(-20).max(0),
  evidence: z.string(),
  explanation: z.string(),
});

const sourceCheckSchema = z.object({
  source: z.string(),
  status: z.enum(["checked", "not_configured", "error", "demo"]),
  provider: z.string().optional(),
  queryCount: z.number().int().min(0),
  resultCount: z.number().int().min(0),
  summary: z.string(),
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
  whyNotLower: z.array(z.string()),
});

export const riskOutputSchema = {
  companyName: z.string(),
  riskScore: z.number().min(0).max(100),
  riskLevel: z.enum(["Clear", "Watchlist", "Cloudy", "Storm Warning"]),
  confidence: z.enum(["Low", "Medium", "High"]),
  summary: z.string(),
  signals: z.array(signalSchema),
  calmSignals: z.array(calmSignalSchema),
  sourceChecks: z.array(sourceCheckSchema),
  missingEvidence: z.array(z.string()),
  watchNext: z.array(z.string()),
  scoreDetails: scoreDetailsSchema,
};

type Signal = z.infer<typeof signalSchema>;
type CalmSignal = z.infer<typeof calmSignalSchema>;
type SourceCheck = z.infer<typeof sourceCheckSchema>;
type RiskLevel = z.infer<typeof riskOutputSchema.riskLevel>;
type Confidence = z.infer<typeof riskOutputSchema.confidence>;
type SignalScale = Signal["severity"];
type RiskCategory = Signal["category"];
type ScoreDetails = z.infer<typeof scoreDetailsSchema>;

export const firstRunCompanyNames = ["Delivery Hero", "Intercom", "Zalando", "DeepL"] as const;

export const fallbackDemoCompanyNames = [
  "HealthyCo GmbH",
  "WatchlistTech GmbH",
  "RecentLayoff GmbH",
  "StormAG",
  "Delivery Hero",
] as const;

export const radarDemoCompanyNames = [
  "Deel",
  "Personio",
  "Intercom",
  "Zalando",
  "N26",
  "Pipedrive",
  "Acronis",
  "DeepL",
  "Delivery Hero",
  "Flix",
] as const;

export const signalSourcesAnalyzed = [
  "Employee activity",
  "Public company communications",
  "Careers data",
  "DACH business press",
  "Workplace review signals",
] as const;

export type RiskOutput = {
  companyName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  confidence: Confidence;
  summary: string;
  signals: Signal[];
  calmSignals: CalmSignal[];
  sourceChecks: SourceCheck[];
  missingEvidence: string[];
  watchNext: string[];
  scoreDetails: ScoreDetails;
};

const dachPressSources = [
  "Handelsblatt",
  "WirtschaftsWoche",
  "Manager Magazin",
  "Business Insider Deutschland",
  "Finance Forward",
  "Deutsche Startups",
  "t3n",
  "Heise",
  "FAZ",
  "Süddeutsche Zeitung",
  "Tagesspiegel",
];

const kununuPatterns = [
  "Umstrukturierung",
  "Unsicherheit",
  "Entlassungen",
  "schlechte Kommunikation",
  "Mitarbeiterabbau",
  "ständige Reorganisation",
  "Angst",
  "Führungswechsel",
  "Einstellungsstopp",
];

const categoryCaps: Record<RiskCategory, number> = {
  "Market Context": 8,
  "Leadership Language": 12,
  Kununu: 15,
  Careers: 20,
  "Company-Owned": 35,
  "DACH Press": 35,
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
  sourceReliability: SignalScale,
  companySpecific: boolean,
  evidence: string,
  explanation: string,
): Signal {
  return {
    title,
    category,
    severity,
    confidence,
    recency,
    sourceReliability,
    companySpecific,
    evidence,
    explanation,
  };
}

function calmSignal(
  title: string,
  impact: number,
  evidence: string,
  explanation: string,
): CalmSignal {
  return { title, impact, evidence, explanation };
}

function sourceCheck(
  source: string,
  status: SourceCheck["status"],
  resultCount: number,
  summary: string,
): SourceCheck {
  return {
    source,
    status,
    provider: status === "demo" ? "calibrated demo data" : "simulated DACH collector",
    queryCount: status === "error" ? 0 : 1,
    resultCount,
    summary,
  };
}

function defaultSourceChecks(
  signals: Signal[],
  calmSignals: CalmSignal[],
  missingEvidence: string[],
  status: SourceCheck["status"] = "checked",
): SourceCheck[] {
  const evidenceText = `${JSON.stringify(signals)} ${JSON.stringify(calmSignals)} ${JSON.stringify(missingEvidence)}`;

  return [
    sourceCheck(
      "Employee activity",
      status,
      signals.filter((item) => item.category === "Kununu").length,
      evidenceText.includes("Kununu")
        ? "Employee-sentiment style signals were included in the scan."
        : "No repeated employee signal cluster was surfaced.",
    ),
    sourceCheck(
      "Public company communications",
      status,
      signals.filter((item) => item.category === "Company-Owned" || item.category === "Leadership Language").length,
      "Company-owned and leadership-language indicators were considered.",
    ),
    sourceCheck(
      "Careers data",
      status,
      signals.filter((item) => item.category === "Careers").length + calmSignals.filter((item) => item.title.includes("hiring")).length,
      "Hiring visibility and role coverage were considered.",
    ),
    sourceCheck(
      "DACH business press",
      status,
      signals.filter((item) => item.category === "DACH Press" || item.category === "Market Context").length,
      "DACH press and market context signals were considered.",
    ),
    sourceCheck(
      "Workplace review signals",
      status,
      signals.filter((item) => item.category === "Kununu").length,
      "Workplace review language was treated as supporting evidence only.",
    ),
  ];
}

function isGenericMarketSignal(item: Signal) {
  return item.category === "Market Context";
}

function isVagueLeadershipSignal(item: Signal) {
  return item.category === "Leadership Language" && item.severity <= 1;
}

function hasCompanySpecificEvidence(signals: Signal[]) {
  return signals.some((item) => item.companySpecific && item.confidence >= 2);
}

function hasRecentCompanySpecificEvidence(signals: Signal[]) {
  return signals.some((item) => item.companySpecific && item.recency >= 4 && item.confidence >= 3);
}

function hasReputablePressConfirmation(signals: Signal[]) {
  return signals.some(
    (item) =>
      item.category === "DACH Press" &&
      item.companySpecific &&
      item.sourceReliability >= 4 &&
      item.confidence >= 4 &&
      item.severity >= 4,
  );
}

function confidenceFor(signals: Signal[], missingEvidence: string[]): Confidence {
  if (hasReputablePressConfirmation(signals) && missingEvidence.length <= 2) return "High";

  const companySignals = signals.filter((item) => item.companySpecific);
  const averageConfidence =
    companySignals.reduce(
      (total, item) => total + (item.confidence + item.sourceReliability) / 2,
      0,
    ) / Math.max(1, companySignals.length);

  if (averageConfidence >= 4 && missingEvidence.length <= 3) return "High";
  if (averageConfidence >= 3) return "Medium";
  return "Low";
}

function calculateScore(signals: Signal[], calmSignals: CalmSignal[]): ScoreDetails {
  const categoryTotals = new Map<RiskCategory, number>();

  for (const item of signals) {
    const cap = categoryCaps[item.category];
    const severityFactor: Record<SignalScale, number> = {
      1: 0.35,
      2: 0.5,
      3: 0.7,
      4: 0.9,
      5: 1,
    };
    const confidenceFactor: Record<SignalScale, number> = {
      1: 0.45,
      2: 0.6,
      3: 0.75,
      4: 0.9,
      5: 1,
    };
    const recencyFactor: Record<SignalScale, number> = {
      1: 0.5,
      2: 0.65,
      3: 0.8,
      4: 0.9,
      5: 1,
    };
    const reliabilityFactor: Record<SignalScale, number> = {
      1: 0.55,
      2: 0.65,
      3: 0.75,
      4: 0.9,
      5: 1,
    };
    const contribution =
      cap *
      severityFactor[item.severity] *
      confidenceFactor[item.confidence] *
      recencyFactor[item.recency] *
      reliabilityFactor[item.sourceReliability];
    categoryTotals.set(item.category, Math.min(cap, (categoryTotals.get(item.category) ?? 0) + contribution));
  }

  const categoryContributions = [...categoryTotals.entries()].map(([category, contribution]) => ({
    category,
    contribution: Math.round(contribution),
    cap: categoryCaps[category],
  }));

  const baseline = signals.length > 0 ? 40 : 0;
  const rawRiskScore = Math.min(
    100,
    Math.round(
      baseline + categoryContributions.reduce((total, item) => total + item.contribution, 0),
    ),
  );

  const confirmedPublicLayoff = hasReputablePressConfirmation(signals);
  const requestedCalmModifierTotal = calmSignals.reduce((total, item) => total + item.impact, 0);
  const maxCalmReduction = Math.round(rawRiskScore * (confirmedPublicLayoff ? 0.1 : 0.33));
  const calmModifierTotal = -Math.min(Math.abs(requestedCalmModifierTotal), maxCalmReduction);
  let guardedScore = Math.max(0, Math.min(100, rawRiskScore + calmModifierTotal));

  const whyNotHigher: string[] = [];
  const whyNotLower: string[] = [];
  const onlyMarket = signals.length > 0 && signals.every(isGenericMarketSignal);
  const onlyVagueLeadership =
    signals.length > 0 && signals.every((item) => isGenericMarketSignal(item) || isVagueLeadershipSignal(item));
  const companySpecific = hasCompanySpecificEvidence(signals);
  const recentCompanySpecific = hasRecentCompanySpecificEvidence(signals);
  const reputablePress = hasReputablePressConfirmation(signals);

  if (onlyMarket && guardedScore > 40) {
    guardedScore = 40;
    whyNotHigher.push("Generic market pressure alone is capped at Watchlist.");
  }

  if (onlyVagueLeadership && guardedScore > 45) {
    guardedScore = 45;
    whyNotHigher.push("Vague efficiency or focus language alone cannot drive a high score.");
  }

  if (!companySpecific && guardedScore > 55) {
    guardedScore = 55;
    whyNotHigher.push("Score cannot exceed 55 without company-specific evidence.");
  }

  if (!recentCompanySpecific && guardedScore > 65) {
    guardedScore = 65;
    whyNotHigher.push("Score cannot exceed 65 without recent company-specific evidence.");
  }

  if (!reputablePress && guardedScore > 75) {
    guardedScore = 75;
    whyNotHigher.push("Score cannot exceed 75 without reputable public confirmation of layoffs.");
  }

  if (reputablePress && guardedScore < 55) {
    guardedScore = 55;
    whyNotLower.push("Recent company-specific layoff evidence prevents the score from dropping below Cloudy.");
  }

  if (confirmedPublicLayoff && guardedScore < 76) {
    guardedScore = 76;
    whyNotLower.push("Reputable public layoff evidence keeps the score in Storm Warning.");
  }

  if (confirmedPublicLayoff && guardedScore > 94) {
    guardedScore = 94;
  }

  if (recentCompanySpecific) {
    whyNotLower.push("Recent company-specific evidence was found within the strongest time window.");
  }

  if (calmSignals.length > 0) {
    whyNotLower.push("Calm signals reduce, but do not erase, visible risk signals.");
  }

  return {
    rawRiskScore,
    calmModifierTotal,
    guardrailAdjustedScore: Math.round(guardedScore),
    categoryContributions,
    increasedBy: signals.map(
      (item) =>
        `${item.title}: ${item.category} signal scored ${signalScore(item)} before reliability weighting and category caps.`,
    ),
    reducedBy: calmSignals.map((item) => `${item.title}: ${item.impact} possible points.`),
    whyNotHigher,
    whyNotLower,
  };
}

function buildSummary(companyName: string, riskLevel: RiskLevel, confidence: Confidence) {
  if (riskLevel === "Clear") {
    return `${companyName} shows limited visible DACH workplace risk signals. Calm signals and missing formal layoff evidence keep the score low.`;
  }

  if (riskLevel === "Watchlist") {
    return `${companyName} is Watchlist: visible risk signals exist, but public evidence remains limited and no strong DACH press or company-owned restructuring evidence was verified.`;
  }

  if (riskLevel === "Cloudy") {
    return `${companyName} is Cloudy based on recent company-specific visible risk signals. It is not Storm Warning because stronger public confirmation is still missing. Confidence is ${confidence.toLowerCase()}.`;
  }

  return `${companyName} is Storm Warning because high-confidence public layoff or restructuring signals are visible. This is signal analysis only, not a prediction.`;
}

function buildRiskOutput(
  companyName: string,
  signals: Signal[],
  calmSignals: CalmSignal[],
  sourceChecks: SourceCheck[],
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
    sourceChecks: sourceChecks.length > 0 ? sourceChecks : defaultSourceChecks(signals, calmSignals, missingEvidence),
    missingEvidence,
    watchNext,
    scoreDetails,
  };
}

const healthyDemoData = buildRiskOutput(
  "HealthyCo GmbH",
  [
    signal(
      "Generic market caution",
      "Market Context",
      1,
      1,
      4,
      1,
      false,
      "DACH source strategy sees broad tech-market caution, not company-specific layoff evidence.",
      "Market-wide pressure is a weak contextual signal and is capped so it cannot dominate the report.",
    ),
  ],
  [
    calmSignal(
      "Active hiring across multiple functions",
      -10,
      "Careers-style demo data shows hiring in product, engineering, customer success, and operations.",
      "Broad cross-functional hiring is a calm signal.",
    ),
    calmSignal(
      "Product and engineering hiring still active",
      -6,
      "Product and engineering roles remain visible.",
      "Technical hiring reduces concern about a broad freeze.",
    ),
    calmSignal(
      "Recent product launch",
      -8,
      "Company-owned demo source includes a recent product launch.",
      "Growth activity lowers concern, while not proving anything about future staffing.",
    ),
    calmSignal(
      "No public layoff report in demo evidence",
      -8,
      "The healthy demo scenario does not include public layoff, restructuring, or site-closure reporting.",
      "Missing public layoff reporting keeps this demo scenario low.",
    ),
  ],
  [],
  [
    "No public layoff report is included in the healthy demo evidence.",
    "No repeated Kununu uncertainty pattern is included in the healthy demo evidence.",
  ],
  [
    "Watch whether hiring remains active across several functions.",
    "Monitor for public layoff, restructuring, or site-closure reporting.",
  ],
);

const normalSaasDemoData = buildRiskOutput(
  "NormalSaaS GmbH",
  [
    signal(
      "Generic tech pressure",
      "Market Context",
      1,
      2,
      4,
      1,
      false,
      "DACH scan sees market slowdown and AI productivity pressure in the wider software sector.",
      "Generic market pressure is contextual and cannot produce a high score by itself.",
    ),
    signal(
      "Profitability language without cuts",
      "Leadership Language",
      1,
      3,
      4,
      3,
      true,
      "Company-owned leadership language mentions focus, efficiency, and profitability, without headcount language.",
      "This is a low-severity signal because profitability language is common and indirect.",
    ),
  ],
  [
    calmSignal(
      "No public layoff report in demo evidence",
      -4,
      "The NormalSaaS demo scenario does not include public layoff or site-closure reporting.",
      "Missing public confirmation prevents escalation.",
    ),
  ],
  [],
  [
    "No confirmed layoffs or Stellenabbau were found.",
    "No repeated Kununu uncertainty pattern is included in the demo evidence.",
  ],
  [
    "Watch whether efficiency language becomes tied to headcount, consolidation, or budget cuts.",
    "Monitor hiring volume across product, engineering, sales, and customer teams.",
  ],
);

const watchlistTechDemoData = buildRiskOutput(
  "WatchlistTech GmbH",
  [
    signal(
      "Slower hiring",
      "Careers",
      2,
      3,
      4,
      3,
      true,
      "Careers-style demo data shows fewer open roles and narrower functional coverage.",
      "Slower hiring is medium-low severity unless paired with stronger layoff evidence.",
    ),
    signal(
      "Kununu uncertainty pattern",
      "Kununu",
      3,
      3,
      4,
      3,
      true,
      `Repeated review snippets contain terms such as ${kununuPatterns.slice(0, 4).join(", ")}.`,
      "Kununu is subjective, so it supports the score but does not dominate it.",
    ),
    signal(
      "Efficiency language",
      "Leadership Language",
      1,
      3,
      4,
      3,
      true,
      "Leadership language mentions focus and efficiency without layoffs or headcount language.",
      "Vague efficiency language adds context only.",
    ),
  ],
  [
    calmSignal(
      "No confirmed layoffs",
      -5,
      "No reputable DACH press or official source confirms layoffs.",
      "Missing confirmation keeps the score below elevated risk.",
    ),
  ],
  [],
  [
    "No confirmed layoffs were found.",
    "No reputable public layoff or site-closure report is included in this demo evidence.",
  ],
  [
    "Watch whether Kununu uncertainty aligns with reputable DACH press or company-owned updates.",
    "Monitor role removals and any shift toward Einstellungsstopp language.",
  ],
);

const recentLayoffDemoData = buildRiskOutput(
  "RecentLayoff GmbH",
  [
    signal(
      "Recent restructuring reporting",
      "DACH Press",
      3,
      3,
      5,
      4,
      true,
      "Demo DACH press-style coverage references recent restructuring pressure without a confirmed workforce-reduction scope.",
      "Recent public reporting is company-specific evidence, but it stays below Storm Warning without confirmation.",
    ),
    signal(
      "Kununu uncertainty aligns with public reports",
      "Kununu",
      3,
      3,
      4,
      3,
      true,
      "Kununu-style snippets mention Unsicherheit, Umstrukturierung, and schlechte Kommunikation.",
      "Kununu supports the score because it aligns with public reporting and hiring visibility.",
    ),
    signal(
      "Reduced role visibility",
      "Careers",
      2,
      3,
      4,
      3,
      true,
      "Careers-style demo data shows fewer roles and no visible product or engineering growth pattern.",
      "Reduced hiring visibility supports, but does not prove, elevated risk.",
    ),
  ],
  [
    calmSignal(
      "No official company-owned confirmation in demo evidence",
      -5,
      "This demo scenario includes public reporting but no official company-owned confirmation.",
      "Missing official confirmation prevents Storm Warning.",
    ),
  ],
  [],
  ["No official company-owned restructuring confirmation is included in this demo evidence."],
  [
    "Watch for reputable DACH press confirmation.",
    "Check for public company updates or reputable business press coverage.",
  ],
);

const stormDemoData = buildRiskOutput(
  "StormAG",
  [
    signal(
      "Confirmed Stellenabbau",
      "DACH Press",
      4,
      5,
      5,
      5,
      true,
      `Reputable DACH press-style demo coverage references Stellenabbau in sources such as ${dachPressSources.slice(0, 3).join(", ")}.`,
      "Confirmed workforce reduction is a high-severity visible risk signal.",
    ),
    signal(
      "Public site-closure reporting",
      "DACH Press",
      5,
      5,
      5,
      5,
      true,
      "Demo evidence includes reputable public reporting of a site closure tied to restructuring.",
      "Public site-closure reporting is a critical visible risk signal.",
    ),
    signal(
      "Official restructuring update",
      "Company-Owned",
      5,
      4,
      4,
      5,
      true,
      "Company-owned demo source references a restructuring program and affected locations.",
      "Official company-owned restructuring language raises confidence when it aligns with public reporting.",
    ),
  ],
  [
    calmSignal(
      "Some active replacement roles remain",
      -4,
      "A few replacement or operational roles remain visible.",
      "Limited hiring can reduce breadth, but it does not erase confirmed public layoff evidence.",
    ),
  ],
  [],
  [],
  [
    "Watch affected locations and confirmed headcount scope.",
    "Monitor official company updates and reputable business press.",
    "Track whether public restructuring scope changes.",
  ],
);

function cloneDemoData(
  base: RiskOutput,
  companyName: string,
  summary?: string,
  override?: Pick<RiskOutput, "riskScore" | "riskLevel" | "confidence">,
): RiskOutput {
  const replaceDemoNames = (text: string) =>
    text.replace(
      /HealthyCo GmbH|HealthyCo|NormalSaaS GmbH|NormalSaaS|WatchlistTech GmbH|WatchlistTech|RecentLayoff GmbH|RecentLayoff|StormAG/g,
      companyName,
    );

  const riskScore = override?.riskScore ?? base.riskScore;
  const riskLevel = override?.riskLevel ?? base.riskLevel;
  const confidence = override?.confidence ?? base.confidence;

  return {
    ...base,
    companyName,
    riskScore,
    riskLevel,
    confidence,
    summary: summary ?? buildSummary(companyName, riskLevel, confidence),
    signals: base.signals.map((item) => ({
      ...item,
      evidence: replaceDemoNames(item.evidence),
      explanation: replaceDemoNames(item.explanation),
    })),
    calmSignals: base.calmSignals.map((item) => ({
      ...item,
      evidence: replaceDemoNames(item.evidence),
      explanation: replaceDemoNames(item.explanation),
    })),
    sourceChecks: defaultSourceChecks(base.signals, base.calmSignals, base.missingEvidence, "demo"),
    missingEvidence: base.missingEvidence.map(replaceDemoNames),
    watchNext: base.watchNext.map(replaceDemoNames),
    scoreDetails: {
      ...base.scoreDetails,
      guardrailAdjustedScore: riskScore,
      increasedBy: base.scoreDetails.increasedBy.map(replaceDemoNames),
      reducedBy: base.scoreDetails.reducedBy.map(replaceDemoNames),
      whyNotHigher: base.scoreDetails.whyNotHigher.map(replaceDemoNames),
      whyNotLower: base.scoreDetails.whyNotLower.map(replaceDemoNames),
      categoryContributions: base.scoreDetails.categoryContributions.map((item) => ({ ...item })),
    },
  };
}

const deelDemoData = cloneDemoData(
  watchlistTechDemoData,
  "Deel",
  "Deel is Watchlist: the demo scan shows hiring and sentiment signals, but no high-confidence public restructuring confirmation.",
  { riskScore: 44, riskLevel: "Watchlist", confidence: "Medium" },
);
const personioDemoData = cloneDemoData(
  normalSaasDemoData,
  "Personio",
  "Personio is Watchlist: the demo scan shows generic tech pressure and profitability language, but no confirmed workforce-reduction reporting.",
  { riskScore: 39, riskLevel: "Watchlist", confidence: "Low" },
);
const intercomDemoData = cloneDemoData(
  healthyDemoData,
  "Intercom",
  "Intercom shows limited visible DACH workplace risk signals in this demo portfolio view.",
  { riskScore: 24, riskLevel: "Clear", confidence: "Low" },
);
const zalandoDemoData = cloneDemoData(
  watchlistTechDemoData,
  "Zalando",
  "Zalando is Watchlist: the demo scan shows slower hiring and employee sentiment patterns, but no confirmed public restructuring evidence.",
  { riskScore: 47, riskLevel: "Watchlist", confidence: "Medium" },
);
const n26DemoData = cloneDemoData(
  recentLayoffDemoData,
  "N26",
  "N26 is Cloudy in this demo portfolio view based on recent company-specific public signals without official confirmation.",
  { riskScore: 62, riskLevel: "Cloudy", confidence: "Medium" },
);
const pipedriveDemoData = cloneDemoData(
  healthyDemoData,
  "Pipedrive",
  "Pipedrive shows limited visible DACH workplace risk signals in this demo portfolio view.",
  { riskScore: 23, riskLevel: "Clear", confidence: "Low" },
);
const acronisDemoData = cloneDemoData(
  recentLayoffDemoData,
  "Acronis",
  "Acronis is Cloudy in this demo portfolio view based on recent company-specific public signals and hiring visibility.",
  { riskScore: 60, riskLevel: "Cloudy", confidence: "Medium" },
);
const deeplDemoData = cloneDemoData(
  healthyDemoData,
  "DeepL",
  "DeepL shows limited visible DACH workplace risk signals in this demo portfolio view.",
  { riskScore: 21, riskLevel: "Clear", confidence: "Medium" },
);
const deliveryHeroDemoData = cloneDemoData(
  stormDemoData,
  "Delivery Hero",
  "Delivery Hero is Storm Warning in this demo portfolio view because high-confidence public restructuring signals are visible.",
  { riskScore: 84, riskLevel: "Storm Warning", confidence: "High" },
);
const flixDemoData = cloneDemoData(
  normalSaasDemoData,
  "Flix",
  "Flix is Watchlist: the demo scan shows market pressure and indirect company language, but no confirmed workforce-reduction reporting.",
  { riskScore: 41, riskLevel: "Watchlist", confidence: "Low" },
);

const demoCompanies: Record<string, RiskOutput> = {
  healthyco: healthyDemoData,
  healthycogmbh: healthyDemoData,
  demosoft: healthyDemoData,
  normalsaas: normalSaasDemoData,
  normalsaasgmbh: normalSaasDemoData,
  scalenow: normalSaasDemoData,
  watchlisttech: watchlistTechDemoData,
  watchlisttechgmbh: watchlistTechDemoData,
  recentlayoff: recentLayoffDemoData,
  recentlayoffgmbh: recentLayoffDemoData,
  budgetcloud: recentLayoffDemoData,
  stormag: stormDemoData,
  futuremobility: stormDemoData,
  deel: deelDemoData,
  personio: personioDemoData,
  intercom: intercomDemoData,
  zalando: zalandoDemoData,
  n26: n26DemoData,
  pipedrive: pipedriveDemoData,
  acronis: acronisDemoData,
  deepl: deeplDemoData,
  deliveryhero: deliveryHeroDemoData,
  flix: flixDemoData,
};

export function isKnownDemoCompany(companyName: string) {
  return normalizeDemoKey(companyName) in demoCompanies;
}

function calibratedDemoFor(companyName: string) {
  const fallbackNames = [...fallbackDemoCompanyNames];
  const baseName = fallbackNames[hashCompany(companyName) % fallbackNames.length];
  const base = demoCompanies[normalizeDemoKey(baseName)];
  return cloneDemoData(
    base,
    companyName,
    `${companyName} is shown in protected demo mode with calibrated DACH workplace-weather evidence and a complete report.`,
  );
}

function addSignal(signals: Signal[], item: Signal) {
  signals.push(item);
}

function collectSignals(companyName: string) {
  const seed = hashCompany(companyName);
  const signals: Signal[] = [];
  const calmSignals: CalmSignal[] = [];
  const missingEvidence: string[] = [];

  addSignal(
    signals,
    signal(
      "DACH market context",
      "Market Context",
      1,
      1,
      4,
      1,
      false,
      `Simulated DACH collector checks ${dachPressSources.slice(0, 6).join(", ")} and broad market context for ${companyName}.`,
      "Market context is weak evidence and is capped at low contribution.",
    ),
  );

  if (seed % 4 === 0) {
    calmSignals.push(
      calmSignal(
        "Active hiring across multiple functions",
        -10,
        "Simulated careers data still shows roles across several functions.",
        "Active cross-functional hiring is a calm counter-signal.",
      ),
    );
  } else if (seed % 4 === 1) {
    addSignal(
      signals,
      signal(
        "Slower DACH hiring footprint",
        "Careers",
        2,
        3,
        4,
        3,
        true,
        "Simulated careers page shows fewer open roles and narrower department coverage.",
        "Slower hiring is a medium-low company-specific signal.",
      ),
    );
  }

  if ((seed >> 2) % 3 > 0) {
    addSignal(
      signals,
      signal(
        "Efficiency language without formal cuts",
        "Leadership Language",
        1,
        3,
        4,
        3,
        true,
        "Company-owned language mentions focus, efficiency, profitability, or sustainable growth.",
        "This stays low severity unless tied to headcount, consolidation, or public layoff reporting.",
      ),
    );
  }

  if ((seed >> 4) % 5 >= 3) {
    addSignal(
      signals,
      signal(
        "Kununu uncertainty pattern",
        "Kununu",
        2,
        2,
        3,
        3,
        true,
        `Simulated Kununu snippets mention ${kununuPatterns.slice(0, 3).join(", ")}.`,
        "Kununu is subjective and supports the score only when corroborated.",
      ),
    );
  } else {
    missingEvidence.push("No repeated Kununu uncertainty pattern was found.");
  }

  if ((seed >> 8) % 14 === 13) {
    addSignal(
      signals,
      signal(
        "Public workforce-reduction report",
        "DACH Press",
        4,
        4,
        5,
        5,
        true,
        "Simulated public-source collector found company-specific workforce-reduction reporting.",
        "Reputable public reporting is treated as high-confidence visible evidence.",
      ),
    );
  } else {
    missingEvidence.push("No reputable public workforce-reduction report was surfaced by the current scan.");
  }

  if (signals.every((item) => item.category === "Market Context")) {
    calmSignals.push(
      calmSignal(
        "Only generic market signals found",
        -15,
        "The simulated scan found only broad DACH market pressure.",
        "Generic market signals cannot push a company into elevated risk.",
      ),
    );
  }

  return { signals, calmSignals, missingEvidence };
}

async function liveAnalysis(companyName: string) {
  const { signals, calmSignals, missingEvidence } = collectSignals(companyName);

  return buildRiskOutput(
    companyName,
    signals,
    calmSignals,
    defaultSourceChecks(signals, calmSignals, missingEvidence),
    missingEvidence,
    [
      "Watch for reputable DACH press confirmation from sources such as Handelsblatt, WirtschaftsWoche, Manager Magazin, t3n, Heise, FAZ, or Süddeutsche.",
      "Check Kununu for repeated patterns that align with news, hiring, or company-owned updates.",
      "Look for public company updates or reputable press reports that directly mention headcount, layoffs, or site closures.",
    ],
  );
}

function genericCloudyDemoData(companyName: string): RiskOutput {
  const signals = [
    signal(
      "Efficiency language detected",
      "Leadership Language",
      1,
      3,
      4,
      3,
      true,
      "Fallback data found generic focus, efficiency, or profitability language.",
      "This is deliberately low severity because it is not layoff evidence.",
    ),
    signal(
      "Hiring visibility limited",
      "Careers",
      2,
      3,
      3,
      3,
      true,
      "Fallback data could not establish broad current hiring.",
      "Limited hiring visibility raises watchlist risk, but not high risk without stronger evidence.",
    ),
  ];
  const calmSignals = [
    calmSignal(
      "No public layoff report verified",
      -6,
      "Fallback data has no reputable public layoff or site-closure confirmation.",
      "Missing public confirmation keeps the fallback cautious.",
    ),
  ];
  const missingEvidence = [
    "Live analysis failed, so this result uses cautious fallback data.",
    "No verified public layoff report was available in the fallback path.",
  ];

  return buildRiskOutput(
    companyName,
    signals,
    calmSignals,
    defaultSourceChecks(signals, calmSignals, missingEvidence, "error"),
    missingEvidence,
    [
      "Re-run analysis when live sources are available.",
      "Watch for Kununu corroboration, hiring changes, and reputable public reporting.",
    ],
    `${companyName} is shown with cautious fallback data; risk remains limited by missing high-confidence DACH signals.`,
  );
}

function normalizeDemoKey(companyName: string) {
  return companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function analyzeCompany(
  companyName: string,
  options: { demoMode?: boolean } = {},
): Promise<RiskOutput> {
  const demoData = demoCompanies[normalizeDemoKey(companyName)];
  if (demoData) {
    return demoData;
  }

  if (options.demoMode) {
    return calibratedDemoFor(companyName);
  }

  try {
    return await liveAnalysis(companyName);
  } catch {
    return genericCloudyDemoData(companyName);
  }
}
