import { McpServer } from "skybridge/server";
import { z } from "zod";

const countrySchema = z.enum(["DE", "US", "EU"]);

const signalSchema = z.object({
  title: z.string(),
  category: z.enum([
    "News",
    "Hiring",
    "Employee Sentiment",
    "Leadership Language",
    "German Legal Signal",
  ]),
  severity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  confidence: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  recency: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  evidence: z.string(),
  explanation: z.string(),
});

const riskOutputSchema = {
  companyName: z.string(),
  riskScore: z.number().min(0).max(100),
  riskLevel: z.enum(["Clear", "Watchlist", "Cloudy", "Storm Warning"]),
  confidence: z.enum(["Low", "Medium", "High"]),
  summary: z.string(),
  signals: z.array(signalSchema),
  missingEvidence: z.array(z.string()),
  watchNext: z.array(z.string()),
};

type Country = z.infer<typeof countrySchema>;
type Signal = z.infer<typeof signalSchema>;
type RiskLevel = z.infer<typeof riskOutputSchema.riskLevel>;
type Confidence = z.infer<typeof riskOutputSchema.confidence>;
type SignalScale = Signal["severity"];
type RiskOutput = {
  companyName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  confidence: Confidence;
  summary: string;
  signals: Signal[];
  missingEvidence: string[];
  watchNext: string[];
};

const highRiskGermanTerms = [
  "Sozialplan",
  "Interessenausgleich",
  "Massenentlassung",
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

function confidenceFor(signals: Signal[], missingEvidence: string[]): Confidence {
  const decisiveSignal = signals.some(
    (signal) => signal.severity === 5 && signal.confidence === 5 && signal.recency >= 4,
  );
  if (decisiveSignal && missingEvidence.length <= 2) return "High";

  const averageConfidence =
    signals.reduce((total, signal) => total + signal.confidence, 0) /
    Math.max(1, signals.length);
  if (averageConfidence >= 4 && missingEvidence.length <= 1) return "High";
  if (averageConfidence >= 3 && missingEvidence.length <= 2) return "Medium";
  return "Low";
}

function addSignal(
  signals: Signal[],
  category: Signal["category"],
  title: string,
  severity: SignalScale,
  confidence: SignalScale,
  recency: SignalScale,
  evidence: string,
  explanation: string,
) {
  signals.push({
    title,
    category,
    severity,
    confidence,
    recency,
    evidence,
    explanation,
  });
}

function signalScore(signal: Signal) {
  return signal.severity * signal.confidence * signal.recency;
}

function normalizedRiskScore(signals: Signal[]) {
  if (signals.length === 0) return 0;
  const remainingSafeShare = signals.reduce((remaining, signal) => {
    const normalizedSignalRisk = signalScore(signal) / (5 * 5 * 5);
    return remaining * (1 - normalizedSignalRisk);
  }, 1);
  return Math.round((1 - remainingSafeShare) * 100);
}

function buildRiskOutput(
  companyName: string,
  signals: Signal[],
  missingEvidence: string[],
  watchNext: string[],
  summary?: string,
): RiskOutput {
  const riskScore = normalizedRiskScore(signals);
  const riskLevel = riskLevelFor(riskScore);
  const confidence = confidenceFor(signals, missingEvidence);
  const strongestSignal = [...signals].sort((a, b) => signalScore(b) - signalScore(a))[0];

  return {
    companyName,
    riskScore,
    riskLevel,
    confidence,
    summary:
      summary ??
      (riskLevel === "Clear"
        ? `${companyName} has limited simulated layoff-risk evidence. Keep monitoring because low signal does not prove absence of risk.`
        : `${companyName} is rated ${riskLevel} based mainly on ${strongestSignal?.category.toLowerCase() ?? "limited evidence"}, with ${confidence.toLowerCase()} confidence.`),
    signals,
    missingEvidence,
    watchNext,
  };
}

function signal(
  title: string,
  category: Signal["category"],
  severity: SignalScale,
  confidence: SignalScale,
  recency: SignalScale,
  evidence: string,
  explanation: string,
): Signal {
  return { title, category, severity, confidence, recency, evidence, explanation };
}

const clearDemoData = buildRiskOutput(
  "DemoSoft",
  [
    signal(
      "Balanced hiring footprint",
      "Hiring",
      1,
      4,
      4,
      "Demo careers data shows steady product, engineering, customer success, and operations hiring.",
      "Broad hiring across core functions usually argues against an imminent broad restructuring cycle.",
    ),
    signal(
      "Leadership language remains growth-oriented",
      "Leadership Language",
      1,
      3,
      4,
      "Recent executive messaging emphasizes roadmap delivery, customer expansion, and team growth.",
      "Growth language is not a guarantee, but it is meaningfully softer than efficiency, streamlining, or profitability-push language.",
    ),
  ],
  [
    "Employee sentiment sources are limited in this demo story.",
    "No German legal/process terms were found in the demo scan.",
  ],
  [
    "Watch whether open roles remain distributed across product, engineering, and customer-facing functions.",
    "Monitor leadership updates for a shift from growth language to efficiency or profitability language.",
    "Re-check news for layoffs, restructuring, or hiring freeze terms.",
  ],
  "DemoSoft looks clear in this demo story: hiring appears broad, leadership language is steady, and no formal restructuring indicators are present.",
);

const cloudyDemoData = buildRiskOutput(
  "ScaleNow",
  [
    signal(
      "Efficiency language detected",
      "Leadership Language",
      2,
      3,
      4,
      "Demo leadership posts repeatedly mention focus, efficiency, sustainable growth, and disciplined investment.",
      "This language often appears before cost-cutting, org consolidation, or tighter operating discipline, but it remains indirect.",
    ),
    signal(
      "Hiring slowdown pattern",
      "Hiring",
      3,
      4,
      4,
      "Demo careers data shows few new roles and limited product or engineering hiring.",
      "A hiring slowdown can signal budget pressure, especially if growth roles disappear or backfills become selective.",
    ),
    signal(
      "Employee uncertainty themes",
      "Employee Sentiment",
      3,
      3,
      3,
      "Demo review snippets mention reorg fatigue, unclear priorities, and weak communication.",
      "Employee sentiment is a softer signal, but repeated uncertainty language can precede more formal restructuring announcements.",
    ),
  ],
  ["No formal German legal/process terms were found in this demo story."],
  [
    "Watch for sudden role removals from the careers page.",
    "Track whether efficiency language turns into profitability targets or operating model changes.",
    "Monitor employee-review language for mentions of reorgs, communication gaps, or hiring freezes.",
  ],
  "ScaleNow is cloudy in this demo story: no decisive layoff signal is present, but hiring, leadership language, and sentiment all point toward elevated watchlist risk.",
);

const stormDemoData = buildRiskOutput(
  "FutureMobility",
  [
    signal(
      "Sozialplan negotiations found",
      "German Legal Signal",
      5,
      5,
      5,
      "Demo source data contains Sozialplan, Interessenausgleich, Betriebsrat, Massenentlassung, and Stellenabbau language.",
      "Formal German labor-process terms are high-risk because they often indicate concrete negotiations around workforce reductions.",
    ),
    signal(
      "Restructuring coverage cluster",
      "News",
      4,
      4,
      5,
      "Demo news scan shows restructuring, site consolidation, and profitability-push coverage.",
      "A cluster of public restructuring coverage increases confidence that the risk is not merely internal rumor or generic corporate language.",
    ),
    signal(
      "Engineering roles removed",
      "Hiring",
      4,
      4,
      4,
      "Demo careers data shows previously visible engineering and operations roles disappearing from the open roles list.",
      "Sudden role removals can indicate hiring freezes, budget resets, or pre-announcement workforce planning.",
    ),
  ],
  [],
  [
    "Watch for formal Betriebsrat statements and Sozialplan timelines.",
    "Track site-closure or Standortschließung language in local news.",
    "Monitor whether roles continue disappearing across engineering, product, and operations.",
    "Watch profitability announcements for explicit headcount or operating model language.",
  ],
  "FutureMobility is under storm warning in this demo story: formal German labor-process language, restructuring coverage, and role removals all align.",
);

const demoCompanies: Record<string, RiskOutput> = {
  demosoft: clearDemoData,
  scalenow: cloudyDemoData,
  futuremobility: stormDemoData,
};

function collectSignals(companyName: string, country: Country | undefined) {
  const normalizedCountry = country ?? "EU";
  const seed = hashCompany(`${companyName}:${normalizedCountry}`);
  const signals: Signal[] = [];
  const missingEvidence: string[] = [];

  const newsPressure = seed % 4;
  if (newsPressure === 0) {
    missingEvidence.push(
      "No recent simulated news hits for layoffs, restructuring, hiring freeze, or local-language equivalents.",
    );
  } else {
    addSignal(
      signals,
      "News",
      newsPressure >= 3 ? "Cost-cutting coverage cluster" : "Restructuring language in coverage",
      newsPressure >= 3 ? 4 : 3,
      newsPressure >= 3 ? 4 : 3,
      newsPressure >= 3 ? 4 : 3,
      `Simulated collector checked: ${newsTerms
        .map((term) => `"${companyName} ${term}"`)
        .join(", ")}.`,
      newsPressure >= 3
        ? "A cluster of layoff, restructuring, or cost-cutting coverage is a material external risk signal."
        : "Generic restructuring language matters, but without direct layoff or legal-process evidence it remains moderate.",
    );
  }

  const careersPressure = (seed >> 2) % 4;
  if (careersPressure === 0) {
    addSignal(
      signals,
      "Hiring",
      "Normal hiring footprint",
      1,
      3,
      3,
      "Simulated careers page still shows a balanced mix of product, engineering, operations, and commercial roles.",
      "A broad hiring footprint lowers concern, though it does not rule out targeted reductions elsewhere.",
    );
  } else if (careersPressure === 1) {
    addSignal(
      signals,
      "Hiring",
      "Narrow hiring mix",
      2,
      3,
      4,
      "Open roles appear concentrated in sales or replacement hiring, with limited product and engineering demand.",
      "A narrow role mix can indicate budget discipline or backfill-only hiring, but it is weaker than explicit job-cut evidence.",
    );
  } else {
    addSignal(
      signals,
      "Hiring",
      "Hiring slowdown pattern",
      3,
      4,
      4,
      "Few open roles are visible, some role families look absent, and the collector would watch for removed listings.",
      "A visible hiring slowdown is a meaningful pressure signal, especially when product or engineering roles disappear.",
    );
  }

  const sentimentPressure = (seed >> 4) % 5;
  if (sentimentPressure <= 1) {
    missingEvidence.push(
      "Employee sentiment sources are weak or unavailable in the simulated pass.",
    );
  } else {
    const employeeTerms = [
      "Umstrukturierung",
      "Unsicherheit",
      "Entlassungen",
      "schlechte Kommunikation",
      "ständige Reorg",
    ];
    addSignal(
      signals,
      "Employee Sentiment",
      sentimentPressure >= 4 ? "Repeated internal uncertainty themes" : "Weak internal uncertainty signal",
      sentimentPressure >= 4 ? 3 : 2,
      sentimentPressure >= 4 ? 4 : 2,
      sentimentPressure >= 4 ? 4 : 3,
      `Review-style language contains simulated mentions of ${employeeTerms.join(", ")}.`,
      sentimentPressure >= 4
        ? "Repeated employee uncertainty language can precede formal restructuring news, but it still needs corroboration."
        : "A weak sentiment signal is useful context, not enough on its own to imply layoffs.",
    );
  }

  const leadershipPressure = (seed >> 6) % 4;
  if (leadershipPressure > 0) {
    const euphemisms = [
      "efficiency",
      "focus",
      "profitability",
      "streamlining",
      "sustainable growth",
      "leaner organization",
    ];
    addSignal(
      signals,
      "Leadership Language",
      leadershipPressure >= 3 ? "Profitability push language" : "Efficiency framing",
      leadershipPressure >= 3 ? 3 : 2,
      leadershipPressure >= 3 ? 3 : 3,
      leadershipPressure >= 3 ? 4 : 4,
      `Leadership-language scan flags corporate euphemisms such as ${euphemisms.join(", ")}.`,
      leadershipPressure >= 3
        ? "Profitability and streamlining language can foreshadow cuts, but it remains indirect unless tied to headcount."
        : "Efficiency rhetoric is a medium-to-weak signal because it is common corporate language.",
    );
  }

  if (normalizedCountry === "DE" || normalizedCountry === "EU") {
    const legalPressure = (seed >> 8) % 5;
    if (legalPressure === 0) {
      missingEvidence.push(
        "No simulated German legal-process terms found: Sozialplan, Interessenausgleich, Massenentlassung, Betriebsrat, betriebsbedingte Kündigungen, Standortschließung, or Stellenabbau.",
      );
    } else {
      const terms =
        legalPressure >= 3
          ? highRiskGermanTerms
          : ["Betriebsrat", "Restrukturierung", "Stellenabbau"];
      addSignal(
        signals,
        "German Legal Signal",
        legalPressure >= 3 ? "Sozialplan negotiations found" : "German restructuring vocabulary",
        legalPressure >= 3 ? 5 : 4,
        legalPressure >= 3 ? 5 : 3,
        legalPressure >= 3 ? 5 : 4,
        `Collector simulates hits around ${terms.join(", ")}.`,
        legalPressure >= 3
          ? "Terms like Sozialplan, Interessenausgleich, Massenentlassung, or betriebsbedingte Kündigungen are high-risk because they imply formal labor-process activity."
          : "German restructuring vocabulary is important, but it is less decisive without a formal Sozialplan or Massenentlassung signal.",
      );
    }
  }

  return { signals, missingEvidence };
}

function liveAnalysis(companyName: string, country?: Country) {
  const { signals, missingEvidence } = collectSignals(companyName, country);
  return buildRiskOutput(
    companyName,
    signals,
    missingEvidence,
    [
      "Re-run news searches weekly for layoffs, restructuring, hiring freeze, Sozialplan, Stellenabbau, and Restrukturierung.",
      "Track careers-page role count by function and watch for product or engineering listings disappearing.",
      "Monitor employee-review language for uncertainty, communication complaints, and repeated reorg mentions.",
      "Watch leadership posts for efficiency, focus, profitability, streamlining, sustainable growth, and leaner organization language.",
      "For German entities, prioritize Sozialplan, Interessenausgleich, Massenentlassung, Betriebsrat, betriebsbedingte Kündigungen, Standortschließung, and Stellenabbau.",
    ],
  );
}

function genericCloudyDemoData(companyName: string): RiskOutput {
  return buildRiskOutput(
    companyName,
    [
      signal(
        "Efficiency language detected",
        "Leadership Language",
        2,
        3,
        4,
        "Fallback demo data found generic efficiency, focus, and sustainable growth language.",
        "This is a medium-to-weak signal because it can precede cost control, but it is common corporate language and needs corroboration.",
      ),
      signal(
        "Hiring visibility limited",
        "Hiring",
        3,
        3,
        3,
        "Fallback demo data could not establish a broad current hiring footprint.",
        "Limited hiring visibility increases uncertainty, especially if product or engineering demand is unclear.",
      ),
      signal(
        "Employee sentiment unavailable",
        "Employee Sentiment",
        2,
        2,
        3,
        "Fallback demo data has no reliable employee-review signal.",
        "Missing sentiment data should be treated as uncertainty, not proof that the internal environment is healthy or unhealthy.",
      ),
    ],
    [
      "Live analysis failed, so this result uses generic cloudy fallback data.",
      "No verified German legal/process terms were available in the fallback path.",
    ],
    [
      "Watch for hiring freeze language or sudden role removals.",
      "Monitor leadership updates for profitability, streamlining, or leaner organization language.",
      "Look for formal works council, Sozialplan, or Massenentlassung terms if the company has German operations.",
      "Re-run analysis when live sources are available.",
    ],
    `${companyName} is shown with generic cloudy fallback data because live analysis was unavailable.`,
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
      "Analyze or simulate layoff and restructuring risk for a company using news, careers, employee sentiment, leadership language, and German legal/process signals.",
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
          text: `${structuredContent.companyName}: ${structuredContent.riskLevel} (${structuredContent.riskScore}/100), confidence ${structuredContent.confidence}.`,
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
