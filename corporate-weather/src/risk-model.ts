import { z } from "zod";

export const countrySchema = z.enum(["DACH", "DE", "AT", "CH"]);

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
  "LinkedIn Employee Cluster",
  "Careers",
  "Company-Owned",
  "DACH Press",
  "DACH Legal / Workplace",
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

const employeeLayoffClusterSchema = z.object({
  title: z.string(),
  postCount: z.number().int().min(1),
  timeWindow: z.string(),
  severity: scaleSchema,
  confidence: scaleSchema,
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
  employeeLayoffClusters: z.array(employeeLayoffClusterSchema),
  dachLegalTermsDetected: z.array(z.string()),
  sourceChecks: z.array(sourceCheckSchema),
  missingEvidence: z.array(z.string()),
  watchNext: z.array(z.string()),
  scoreDetails: scoreDetailsSchema,
};

type Country = z.infer<typeof countrySchema>;
type Signal = z.infer<typeof signalSchema>;
type CalmSignal = z.infer<typeof calmSignalSchema>;
type EmployeeLayoffCluster = z.infer<typeof employeeLayoffClusterSchema>;
type SourceCheck = z.infer<typeof sourceCheckSchema>;
type RiskLevel = z.infer<typeof riskOutputSchema.riskLevel>;
type Confidence = z.infer<typeof riskOutputSchema.confidence>;
type SignalScale = Signal["severity"];
type RiskCategory = Signal["category"];
type ScoreDetails = z.infer<typeof scoreDetailsSchema>;

export type RiskOutput = {
  companyName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  confidence: Confidence;
  summary: string;
  signals: Signal[];
  calmSignals: CalmSignal[];
  employeeLayoffClusters: EmployeeLayoffCluster[];
  dachLegalTermsDetected: string[];
  sourceChecks: SourceCheck[];
  missingEvidence: string[];
  watchNext: string[];
  scoreDetails: ScoreDetails;
};

type SearchProvider = "brave" | "serpapi" | "tavily";

type SearchConfig = {
  provider: SearchProvider;
  apiKey: string;
};

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  age?: string;
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

const dachLegalTerms = [
  "Stellenabbau",
  "Entlassungen",
  "Kündigungen",
  "betriebsbedingte Kündigungen",
  "Sozialplan",
  "Interessenausgleich",
  "Betriebsrat",
  "Massenentlassung",
  "Massenentlassungsanzeige",
  "Restrukturierung",
  "Umstrukturierung",
  "Standortschließung",
  "Einstellungsstopp",
  "Kurzarbeit",
  "Sparprogramm",
  "Effizienzprogramm",
];

const linkedInLayoffPatterns = [
  "affected by layoffs",
  "impacted by restructuring",
  "my role was eliminated",
  "open to work",
  "leaving [company]",
  "nach meiner Kündigung",
  "von Stellenabbau betroffen",
  "nach der Umstrukturierung",
  "suche eine neue Herausforderung",
  "betroffen von der Restrukturierung",
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

const linkedInSearchPhrases = [
  "affected by layoffs",
  "impacted by restructuring",
  "my role was eliminated",
  "open to work",
  "leaving",
  "nach meiner Kündigung",
  "von Stellenabbau betroffen",
  "nach der Umstrukturierung",
  "suche eine neue Herausforderung",
  "betroffen von der Restrukturierung",
];

const categoryCaps: Record<RiskCategory, number> = {
  "Market Context": 8,
  "Leadership Language": 12,
  Kununu: 15,
  "LinkedIn Employee Cluster": 30,
  Careers: 20,
  "Company-Owned": 35,
  "DACH Press": 35,
  "DACH Legal / Workplace": 45,
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

function employeeCluster(
  title: string,
  postCount: number,
  timeWindow: string,
  severity: SignalScale,
  confidence: SignalScale,
  evidence: string,
  explanation: string,
): EmployeeLayoffCluster {
  return { title, postCount, timeWindow, severity, confidence, evidence, explanation };
}

function sourceCheck(
  source: string,
  status: SourceCheck["status"],
  provider: string | undefined,
  queryCount: number,
  resultCount: number,
  summary: string,
): SourceCheck {
  return { source, status, provider, queryCount, resultCount, summary };
}

function getSearchConfig(): SearchConfig | undefined {
  const requestedProvider = process.env.SEARCH_API_PROVIDER?.toLowerCase() as
    | SearchProvider
    | undefined;

  if (requestedProvider === "brave") {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY ?? process.env.SEARCH_API_KEY;
    return apiKey ? { provider: "brave", apiKey } : undefined;
  }

  if (requestedProvider === "serpapi") {
    const apiKey = process.env.SERPAPI_API_KEY ?? process.env.SEARCH_API_KEY;
    return apiKey ? { provider: "serpapi", apiKey } : undefined;
  }

  if (requestedProvider === "tavily") {
    const apiKey = process.env.TAVILY_API_KEY ?? process.env.SEARCH_API_KEY;
    return apiKey ? { provider: "tavily", apiKey } : undefined;
  }

  if (process.env.BRAVE_SEARCH_API_KEY) {
    return { provider: "brave", apiKey: process.env.BRAVE_SEARCH_API_KEY };
  }

  if (process.env.SERPAPI_API_KEY) {
    return { provider: "serpapi", apiKey: process.env.SERPAPI_API_KEY };
  }

  if (process.env.TAVILY_API_KEY) {
    return { provider: "tavily", apiKey: process.env.TAVILY_API_KEY };
  }

  if (process.env.SEARCH_API_KEY) {
    return { provider: "brave", apiKey: process.env.SEARCH_API_KEY };
  }

  return undefined;
}

function buildLinkedInQueries(companyName: string) {
  const quotedCompany = `"${companyName}"`;
  return linkedInSearchPhrases.map(
    (phrase) => `site:linkedin.com/posts ${quotedCompany} "${phrase}"`,
  );
}

function toText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeSearchResult(result: SearchResult) {
  return `${result.title} ${result.snippet}`.toLowerCase();
}

function isLinkedInResult(result: SearchResult) {
  return /linkedin\.com\/(posts|feed\/update|in)\//i.test(result.url);
}

function resultMatchesLayoffPattern(result: SearchResult) {
  const text = normalizeSearchResult(result);
  return linkedInSearchPhrases.some((phrase) => text.includes(phrase.toLowerCase())) ||
    /stellenabbau|kündigung|restrukturierung|umstrukturierung|open to work|layoff|role was eliminated|betroffen/i.test(
      text,
    );
}

async function searchWeb(query: string, config: SearchConfig): Promise<SearchResult[]> {
  if (config.provider === "brave") {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", "10");
    url.searchParams.set("country", "DE");
    url.searchParams.set("search_lang", "de");
    url.searchParams.set("freshness", "py");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": config.apiKey,
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      throw new Error(`Brave Search returned ${response.status}`);
    }

    const data = (await response.json()) as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> };
    };

    return (data.web?.results ?? []).map((item) => ({
      title: toText(item.title),
      url: toText(item.url),
      snippet: toText(item.description),
      age: toText(item.age),
    }));
  }

  if (config.provider === "serpapi") {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", config.apiKey);
    url.searchParams.set("hl", "de");
    url.searchParams.set("gl", "de");
    url.searchParams.set("num", "10");

    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });

    if (!response.ok) {
      throw new Error(`SerpApi returned ${response.status}`);
    }

    const data = (await response.json()) as {
      organic_results?: Array<{ title?: string; link?: string; snippet?: string; date?: string }>;
    };

    return (data.organic_results ?? []).map((item) => ({
      title: toText(item.title),
      url: toText(item.link),
      snippet: toText(item.snippet),
      age: toText(item.date),
    }));
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: 10,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
      include_images: false,
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`Tavily returned ${response.status}`);
  }

  const data = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }>;
  };

  return (data.results ?? []).map((item) => ({
    title: toText(item.title),
    url: toText(item.url),
    snippet: toText(item.content),
    age: toText(item.published_date),
  }));
}

function classifyLinkedInResults(companyName: string, results: SearchResult[]) {
  const deduped = new Map<string, SearchResult>();

  for (const result of results) {
    if (!result.url || !isLinkedInResult(result) || !resultMatchesLayoffPattern(result)) continue;
    const key = result.url.split("?")[0] || `${result.title}:${result.snippet}`;
    deduped.set(key, result);
  }

  const matches = [...deduped.values()];
  const postCount = matches.length;

  if (postCount === 0) {
    return { matches, cluster: undefined, signal: undefined };
  }

  const severity: SignalScale = postCount >= 10 ? 4 : postCount >= 6 ? 4 : postCount >= 3 ? 3 : 2;
  const confidence: SignalScale = postCount >= 10 ? 5 : postCount >= 6 ? 4 : postCount >= 3 ? 3 : 2;
  const recency: SignalScale = postCount >= 10 ? 5 : postCount >= 3 ? 4 : 3;
  const sampleEvidence = matches
    .slice(0, 3)
    .map((item) => `${item.title || "LinkedIn result"}: ${item.snippet || item.url}`)
    .join(" | ");

  return {
    matches,
    cluster: employeeCluster(
      postCount >= 3 ? "employeeLayoffCluster" : "isolatedLinkedInEmployeeSignal",
      postCount,
      postCount >= 10 ? "recent public snippets, likely 30-60 day cluster" : "public search snippets",
      severity,
      confidence,
      sampleEvidence,
      postCount >= 3
        ? "Public LinkedIn snippets show repeated layoff, restructuring, or open-to-work language connected to this company."
        : "One isolated public LinkedIn snippet is weak evidence and should not dominate the score.",
    ),
    signal: signal(
      postCount >= 3 ? "LinkedIn employee signal cluster" : "Isolated LinkedIn employee signal",
      "LinkedIn Employee Cluster",
      severity,
      confidence,
      recency,
      postCount >= 3 ? 4 : 2,
      true,
      `${postCount} public LinkedIn result${postCount === 1 ? "" : "s"} matched layoff or restructuring language for ${companyName}.`,
      postCount >= 3
        ? "Repeated employee snippets are company-specific evidence, though snippet-only results still need cautious interpretation."
        : "A single snippet is low-confidence employee evidence and should be treated cautiously.",
    ),
  };
}

async function collectLinkedInEmployeeSignals(companyName: string) {
  const config = getSearchConfig();
  const queries = buildLinkedInQueries(companyName);

  if (!config) {
    return {
      signals: [] as Signal[],
      clusters: [] as EmployeeLayoffCluster[],
      sourceCheck: sourceCheck(
        "LinkedIn public snippets",
        "not_configured",
        undefined,
        queries.length,
        0,
        "LinkedIn public snippets were not checked because no search API key is configured.",
      ),
      missingEvidence:
        "LinkedIn public snippets were not checked. Configure SEARCH_API_PROVIDER plus a provider API key to verify employee clusters.",
    };
  }

  try {
    const settled = await Promise.allSettled(
      queries.map(async (query) => searchWeb(query, config)),
    );
    const results = settled.flatMap((item) => (item.status === "fulfilled" ? item.value : []));
    const classified = classifyLinkedInResults(companyName, results);

    return {
      signals: classified.signal ? [classified.signal] : [],
      clusters: classified.cluster ? [classified.cluster] : [],
      sourceCheck: sourceCheck(
        "LinkedIn public snippets",
        "checked",
        config.provider,
        queries.length,
        classified.matches.length,
        classified.matches.length > 0
          ? `Checked public LinkedIn snippets and found ${classified.matches.length} layoff/restructuring match${classified.matches.length === 1 ? "" : "es"}.`
          : "Checked public LinkedIn snippets but did not find enough matching public results. This does not prove no posts exist behind LinkedIn login.",
      ),
      missingEvidence:
        classified.matches.length > 0
          ? undefined
          : "Public search did not return enough LinkedIn layoff/open-to-work snippets; LinkedIn may still contain posts behind login or outside search indexing.",
    };
  } catch (error) {
    return {
      signals: [] as Signal[],
      clusters: [] as EmployeeLayoffCluster[],
      sourceCheck: sourceCheck(
        "LinkedIn public snippets",
        "error",
        config.provider,
        queries.length,
        0,
        `LinkedIn public snippet search failed: ${error instanceof Error ? error.message : "unknown error"}.`,
      ),
      missingEvidence:
        "LinkedIn public snippet search failed, so employee clusters could not be verified.",
    };
  }
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

function hasStrongEmployeeCluster(clusters: EmployeeLayoffCluster[]) {
  return clusters.some((cluster) => cluster.postCount >= 6 && cluster.confidence >= 4);
}

function hasConfirmedFormalSignal(signals: Signal[]) {
  return signals.some(
    (item) =>
      item.category === "DACH Legal / Workplace" &&
      item.severity >= 4 &&
      item.confidence >= 4 &&
      /sozialplan|interessenausgleich|massenentlassung|standortschließung|stellenabbau|betriebsrat/i.test(
        item.title,
      ),
  );
}

function confidenceFor(
  signals: Signal[],
  missingEvidence: string[],
  clusters: EmployeeLayoffCluster[],
): Confidence {
  if (hasConfirmedFormalSignal(signals) && missingEvidence.length <= 2) return "High";
  if (hasStrongEmployeeCluster(clusters) && missingEvidence.length <= 3) return "Medium";

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

function calculateScore(
  signals: Signal[],
  calmSignals: CalmSignal[],
  clusters: EmployeeLayoffCluster[],
): ScoreDetails {
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

  const confirmedFormal = hasConfirmedFormalSignal(signals);
  const strongEmployeeCluster = hasStrongEmployeeCluster(clusters);
  const requestedCalmModifierTotal = calmSignals.reduce((total, item) => total + item.impact, 0);
  const maxCalmReduction = Math.round(rawRiskScore * (confirmedFormal || strongEmployeeCluster ? 0.1 : 0.33));
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

  if (!confirmedFormal && !strongEmployeeCluster && !reputablePress && guardedScore > 75) {
    guardedScore = 75;
    whyNotHigher.push(
      "Score cannot exceed 75 without confirmed layoffs, a strong employee signal cluster, Sozialplan, Betriebsrat involvement, or reputable DACH press confirmation.",
    );
  }

  if ((strongEmployeeCluster || reputablePress) && guardedScore < 55) {
    guardedScore = 55;
    whyNotLower.push("Recent company-specific layoff evidence prevents the score from dropping below Cloudy.");
  }

  if (confirmedFormal && guardedScore < 76) {
    guardedScore = 76;
    whyNotLower.push("Formal DACH legal or workplace evidence keeps the score in Storm Warning.");
  }

  if (confirmedFormal && guardedScore > 94) {
    guardedScore = 94;
  }

  if (!confirmedFormal) {
    whyNotHigher.push(
      "No confirmed Sozialplan, Interessenausgleich, Massenentlassung, Standortschließung, or formal Stellenabbau was found.",
    );
  }

  if (strongEmployeeCluster) {
    whyNotLower.push("Multiple recent employee posts form an employee signal cluster.");
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
    return `${companyName} is Watchlist: visible risk signals exist, but no high-confidence DACH layoff, Sozialplan, Standortschließung, or strong employee cluster was found.`;
  }

  if (riskLevel === "Cloudy") {
    return `${companyName} is Cloudy based on recent company-specific visible risk signals. It is not Storm Warning because formal DACH legal-process evidence remains missing. Confidence is ${confidence.toLowerCase()}.`;
  }

  return `${companyName} is Storm Warning because high-confidence DACH workplace or legal-process signals are visible. This is signal analysis only, not a prediction.`;
}

function buildRiskOutput(
  companyName: string,
  signals: Signal[],
  calmSignals: CalmSignal[],
  employeeLayoffClusters: EmployeeLayoffCluster[],
  dachLegalTermsDetected: string[],
  sourceChecks: SourceCheck[],
  missingEvidence: string[],
  watchNext: string[],
  summary?: string,
): RiskOutput {
  const scoreDetails = calculateScore(signals, calmSignals, employeeLayoffClusters);
  const riskScore = scoreDetails.guardrailAdjustedScore;
  const riskLevel = riskLevelFor(riskScore);
  const confidence = confidenceFor(signals, missingEvidence, employeeLayoffClusters);

  return {
    companyName,
    riskScore,
    riskLevel,
    confidence,
    summary: summary ?? buildSummary(companyName, riskLevel, confidence),
    signals,
    calmSignals,
    employeeLayoffClusters,
    dachLegalTermsDetected,
    sourceChecks,
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
      "No employee cluster in demo evidence",
      -8,
      "The healthy demo scenario does not include recent LinkedIn or Kununu employee-cluster evidence.",
      "This is a demo counter-signal, not a claim about live LinkedIn coverage.",
    ),
    calmSignal(
      "No DACH legal layoff terms found",
      -10,
      "No Sozialplan, Interessenausgleich, Betriebsrat negotiation, Massenentlassung, or Standortschließung terms were found.",
      "Missing formal DACH legal terms strongly limits the score.",
    ),
  ],
  [],
  [],
  [
    sourceCheck(
      "LinkedIn public snippets",
      "demo",
      undefined,
      0,
      0,
      "Demo scenario: no LinkedIn employee cluster is included in the sample evidence.",
    ),
  ],
  [
    "No confirmed DACH legal or workplace layoff terms were found in the demo evidence.",
    "No employee layoff cluster is included in the healthy demo evidence.",
  ],
  [
    "Watch whether hiring remains active across several functions.",
    "Monitor for formal DACH workplace terms if restructuring news appears.",
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
      "No employee cluster in demo evidence",
      -4,
      "The NormalSaaS demo scenario does not include repeated LinkedIn open-to-work or layoff-connected posts.",
      "This keeps the demo cautious without implying live LinkedIn was fully checked.",
    ),
    calmSignal(
      "No DACH legal layoff terms found",
      -4,
      "No Sozialplan, Interessenausgleich, Massenentlassung, or Standortschließung was found.",
      "Missing formal evidence prevents escalation.",
    ),
  ],
  [],
  [],
  [
    sourceCheck(
      "LinkedIn public snippets",
      "demo",
      undefined,
      0,
      0,
      "Demo scenario: no LinkedIn employee cluster is included in the sample evidence.",
    ),
  ],
  [
    "No confirmed layoffs or Stellenabbau were found.",
    "No Kununu pattern or LinkedIn employee cluster is included in the demo evidence.",
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
      "Leadership language mentions focus and efficiency without layoffs or legal-process terms.",
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
    calmSignal(
      "No Sozialplan found",
      -4,
      "No Sozialplan, Interessenausgleich, or Standortschließung was detected.",
      "Missing legal-process terms prevents Storm Warning.",
    ),
  ],
  [],
  [],
  [
    sourceCheck(
      "LinkedIn public snippets",
      "demo",
      undefined,
      0,
      0,
      "Demo scenario: this case focuses on Kununu uncertainty and hiring slowdown, not a LinkedIn cluster.",
    ),
  ],
  [
    "No confirmed layoffs were found.",
    "No employee layoff cluster is included in this Watchlist demo evidence.",
    "No Sozialplan, Interessenausgleich, or Standortschließung was found.",
  ],
  [
    "Watch whether Kununu uncertainty aligns with LinkedIn employee posts.",
    "Monitor role removals and any shift toward Einstellungsstopp language.",
  ],
);

const recentLayoffDemoData = buildRiskOutput(
  "RecentLayoff GmbH",
  [
    signal(
      "Employee layoff cluster detected",
      "LinkedIn Employee Cluster",
      4,
      4,
      5,
      4,
      true,
      `Demo LinkedIn scan found repeated patterns such as ${linkedInLayoffPatterns.slice(0, 4).join(", ")} connected to the company.`,
      "Multiple recent employee posts are stronger than one isolated post, but still need careful wording.",
    ),
    signal(
      "Kununu uncertainty aligns with employee posts",
      "Kununu",
      3,
      3,
      4,
      3,
      true,
      "Kununu-style snippets mention Unsicherheit, Umstrukturierung, and schlechte Kommunikation.",
      "Kununu supports the score because it aligns with the employee cluster.",
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
      "No formal DACH legal process found",
      -10,
      "No Sozialplan, Interessenausgleich, Massenentlassung, or Standortschließung was detected.",
      "Missing formal legal evidence prevents Storm Warning.",
    ),
  ],
  [
    employeeCluster(
      "employeeLayoffCluster",
      7,
      "last 30-60 days",
      4,
      4,
      "Several recent public employee snippets connect open-to-work or role-eliminated language to the company.",
      "A 6+ post cluster is treated as high-confidence employee evidence, but not as formal legal proof.",
    ),
  ],
  [],
  [
    sourceCheck(
      "LinkedIn public snippets",
      "demo",
      undefined,
      0,
      7,
      "Demo scenario: repeated LinkedIn employee snippets are included as an employeeLayoffCluster.",
    ),
  ],
  ["No Sozialplan or Interessenausgleich was found.", "No reputable DACH press confirmation was found."],
  [
    "Watch for reputable DACH press confirmation.",
    "Monitor whether employee posts continue clustering over the next 30 days.",
    "Check for Sozialplan, Betriebsrat, or Massenentlassung language.",
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
      "Sozialplan and Betriebsrat negotiations",
      "DACH Legal / Workplace",
      5,
      5,
      5,
      5,
      true,
      "Demo evidence contains Sozialplan, Betriebsrat negotiations, and Interessenausgleich language.",
      "Formal DACH labor-process terms are critical because they indicate concrete workforce-reduction negotiations.",
    ),
    signal(
      "Standortschließung tied to restructuring",
      "Company-Owned",
      5,
      4,
      4,
      5,
      true,
      "Company-owned demo source references Standortschließung and a restructuring program.",
      "Site-closure language tied to restructuring is a critical signal.",
    ),
  ],
  [
    calmSignal(
      "Some active replacement roles remain",
      -4,
      "A few replacement or operational roles remain visible.",
      "Limited hiring can reduce breadth, but it does not erase confirmed formal layoff evidence.",
    ),
  ],
  [],
  ["Stellenabbau", "Sozialplan", "Betriebsrat", "Interessenausgleich", "Standortschließung"],
  [
    sourceCheck(
      "LinkedIn public snippets",
      "demo",
      undefined,
      0,
      0,
      "Demo scenario: StormAG is driven by formal DACH legal and press evidence, not LinkedIn snippets.",
    ),
  ],
  [],
  [
    "Watch Sozialplan timeline, affected locations, and confirmed headcount scope.",
    "Monitor Betriebsrat statements and official company updates.",
    "Track whether Standortschließung scope changes.",
  ],
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
};

function addSignal(signals: Signal[], item: Signal) {
  signals.push(item);
}

function collectSignals(companyName: string, country: Country | undefined) {
  const normalizedCountry = country ?? "DACH";
  const seed = hashCompany(`${companyName}:${normalizedCountry}`);
  const signals: Signal[] = [];
  const calmSignals: CalmSignal[] = [];
  const clusters: EmployeeLayoffCluster[] = [];
  const detectedTerms: string[] = [];
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
        "This stays low severity unless tied to headcount, consolidation, or legal-process terms.",
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
    detectedTerms.push("Sozialplan", "Betriebsrat", "Stellenabbau");
    addSignal(
      signals,
      signal(
        "Formal DACH workplace process detected",
        "DACH Legal / Workplace",
        5,
        5,
        5,
        5,
        true,
        `Simulated collector found ${detectedTerms.join(", ")} terms.`,
        "Formal DACH workplace terms are critical high-confidence signals.",
      ),
    );
  } else {
    calmSignals.push(
      calmSignal(
        "No DACH legal layoff terms found",
        -10,
        `No high-priority DACH terms were found: ${dachLegalTerms.slice(0, 8).join(", ")}.`,
        "Missing legal/process evidence prevents alarmist scoring.",
      ),
    );
    missingEvidence.push("No confirmed Sozialplan, Interessenausgleich, Massenentlassung, Betriebsrat involvement, or Standortschließung was found.");
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

  return { signals, calmSignals, clusters, detectedTerms, missingEvidence };
}

async function liveAnalysis(companyName: string, country?: Country) {
  const { signals, calmSignals, clusters, detectedTerms, missingEvidence } = collectSignals(
    companyName,
    country,
  );
  const linkedInSignals = await collectLinkedInEmployeeSignals(companyName);
  signals.push(...linkedInSignals.signals);
  clusters.push(...linkedInSignals.clusters);
  if (linkedInSignals.missingEvidence) {
    missingEvidence.push(linkedInSignals.missingEvidence);
  }

  return buildRiskOutput(
    companyName,
    signals,
    calmSignals,
    clusters,
    detectedTerms,
    [linkedInSignals.sourceCheck],
    missingEvidence,
    [
      "Watch for reputable DACH press confirmation from sources such as Handelsblatt, WirtschaftsWoche, Manager Magazin, t3n, Heise, FAZ, or Süddeutsche.",
      "Monitor LinkedIn for repeated employee signal clusters, not isolated posts.",
      "Check Kununu for repeated patterns that align with news, hiring, or employee clusters.",
      "Look for DACH legal terms: Sozialplan, Interessenausgleich, Massenentlassung, Betriebsrat, Standortschließung, or confirmed Stellenabbau.",
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
    ],
    [
      calmSignal(
        "No formal DACH legal signal found",
        -10,
        "Fallback data has no Sozialplan, Interessenausgleich, Massenentlassung, or Standortschließung.",
        "Missing formal evidence keeps the fallback cautious.",
      ),
    ],
    [],
    [],
    [
      sourceCheck(
        "LinkedIn public snippets",
        "error",
        undefined,
        buildLinkedInQueries(companyName).length,
        0,
        "LinkedIn public snippets were not verified because live analysis failed.",
      ),
    ],
    [
      "Live analysis failed, so this result uses cautious fallback data.",
      "No verified DACH legal/process terms were available in the fallback path.",
    ],
    [
      "Re-run analysis when live sources are available.",
      "Watch for LinkedIn employee clusters, Kununu corroboration, and formal DACH legal terms.",
    ],
    `${companyName} is shown with cautious fallback data; risk remains limited by missing high-confidence DACH signals.`,
  );
}

function normalizeDemoKey(companyName: string) {
  return companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function analyzeCompany(companyName: string, country?: Country): Promise<RiskOutput> {
  const demoData = demoCompanies[normalizeDemoKey(companyName)];
  if (demoData) {
    return demoData;
  }

  try {
    return await liveAnalysis(companyName, country);
  } catch {
    return genericCloudyDemoData(companyName);
  }
}
