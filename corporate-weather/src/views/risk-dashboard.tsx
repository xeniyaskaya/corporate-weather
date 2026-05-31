import "../index.css";
import { useEffect, useState } from "react";
import { useOpenExternal, useSetOpenInAppUrl } from "skybridge/web";
import { useCallTool, useToolInfo } from "../helpers.js";
import {
  analyzeCompany,
  fallbackDemoCompanyNames,
  firstRunCompanyNames,
  signalSourcesAnalyzed,
} from "../risk-model.js";

const levelClass = {
  Clear: "level-clear",
  Watchlist: "level-watchlist",
  Cloudy: "level-cloudy",
  "Storm Warning": "level-storm",
};

const scaleLabel = {
  1: "Low",
  2: "Low",
  3: "Medium",
  4: "High",
  5: "High",
};

const mapCompanies = [
  {
    name: "Deel",
    riskLevel: "Watchlist",
    riskScore: 44,
    confidence: "Medium",
    topSignal: "Hiring footprint and profitability language",
    x: 38,
    y: 18,
  },
  {
    name: "Personio",
    riskLevel: "Watchlist",
    riskScore: 39,
    confidence: "Low",
    topSignal: "Efficiency language without confirmed cuts",
    x: 62,
    y: 28,
  },
  {
    name: "Intercom",
    riskLevel: "Clear",
    riskScore: 24,
    confidence: "Low",
    topSignal: "Generic market caution only",
    x: 25,
    y: 46,
  },
  {
    name: "Zalando",
    riskLevel: "Watchlist",
    riskScore: 47,
    confidence: "Medium",
    topSignal: "Slower hiring and employee sentiment pattern",
    x: 70,
    y: 70,
  },
  {
    name: "N26",
    riskLevel: "Cloudy",
    riskScore: 62,
    confidence: "Medium",
    topSignal: "Recent restructuring reporting",
    x: 42,
    y: 56,
  },
  {
    name: "Pipedrive",
    riskLevel: "Clear",
    riskScore: 23,
    confidence: "Low",
    topSignal: "Active hiring counter-signal",
    x: 57,
    y: 76,
  },
  {
    name: "Acronis",
    riskLevel: "Cloudy",
    riskScore: 60,
    confidence: "Medium",
    topSignal: "Reduced role visibility",
    x: 52,
    y: 40,
  },
  {
    name: "DeepL",
    riskLevel: "Clear",
    riskScore: 21,
    confidence: "Medium",
    topSignal: "Product and engineering hiring active",
    x: 48,
    y: 62,
  },
  {
    name: "Delivery Hero",
    riskLevel: "Storm Warning",
    riskScore: 84,
    confidence: "High",
    topSignal: "Confirmed public restructuring evidence",
    x: 78,
    y: 44,
  },
  {
    name: "Flix",
    riskLevel: "Watchlist",
    riskScore: 41,
    confidence: "Low",
    topSignal: "Market pressure with limited company-specific evidence",
    x: 57,
    y: 24,
  },
] satisfies Array<{
  name: string;
  riskLevel: keyof typeof levelClass;
  riskScore: number;
  confidence: RiskOutput["confidence"];
  topSignal: string;
  x: number;
  y: number;
}>;

const weatherStates = [
  {
    name: "Clear",
    score: "0-25",
    detail: "Limited visible public risk signals",
  },
  {
    name: "Watchlist",
    score: "26-50",
    detail: "Weak or early signals need monitoring",
  },
  {
    name: "Cloudy",
    score: "51-75",
    detail: "Recent company-specific evidence appears",
  },
  {
    name: "Storm Warning",
    score: "76-100",
    detail: "Strong public restructuring evidence",
  },
];

const workplaceTerms = [
  "Stellenabbau",
  "Entlassungen",
  "Kündigungen",
  "betriebsbedingte Kündigungen",
  "Restrukturierung",
  "Umstrukturierung",
  "Standortschließung",
  "Einstellungsstopp",
  "Kurzarbeit",
  "Sparprogramm",
  "Effizienzprogramm",
];

const loadingMessages = [
  "Scanning DACH business signals...",
  "Analyzing employee signal clusters...",
  "Checking workplace weather...",
  "Looking for restructuring indicators...",
];

type Screen = "landing" | "report" | "map";
type RouteState = {
  screen: Screen;
  companyName?: string;
};

type RiskOutput = {
  companyName: string;
  riskScore: number;
  riskLevel: keyof typeof levelClass;
  confidence: "Low" | "Medium" | "High";
  summary: string;
  signals: Array<{
    title: string;
    category: string;
    severity: keyof typeof scaleLabel;
    confidence: keyof typeof scaleLabel;
    recency: keyof typeof scaleLabel;
    sourceReliability: keyof typeof scaleLabel;
    companySpecific: boolean;
    evidence: string;
    explanation: string;
  }>;
  calmSignals: Array<{
    title: string;
    impact: number;
    evidence: string;
    explanation: string;
  }>;
  sourceChecks: Array<{
    source: string;
    status: "checked" | "not_configured" | "error" | "demo";
    provider?: string;
    queryCount: number;
    resultCount: number;
    summary: string;
  }>;
  missingEvidence: string[];
  watchNext: string[];
  scoreDetails: {
    rawRiskScore: number;
    calmModifierTotal: number;
    guardrailAdjustedScore: number;
    increasedBy: string[];
    reducedBy: string[];
    whyNotHigher: string[];
    whyNotLower: string[];
    categoryContributions: Array<{
      category: string;
      contribution: number;
      cap: number;
    }>;
  };
};

function isEmbeddedHost() {
  if (typeof window === "undefined") return false;

  try {
    return window.self !== window.top || "openai" in window;
  } catch {
    return true;
  }
}

function hasSkybridgeHost() {
  return typeof window !== "undefined" && "skybridge" in window;
}

function routePath(screen: Screen, companyName?: string) {
  if (screen === "map") return "/radar";
  if (screen === "report" && companyName?.trim()) {
    return `/company/${encodeURIComponent(companyName.trim())}`;
  }
  return "/";
}

function routeUrl(screen: Screen, companyName?: string) {
  if (typeof window === "undefined") return routePath(screen, companyName);

  const path = routePath(screen, companyName);
  const basePath =
    window.location.pathname.startsWith("/try") || window.location.hostname.endsWith("alpic.live")
      ? "/try"
      : "";
  const hashPath = path === "/" ? "" : `#${path}`;

  return `${window.location.origin}${basePath}${hashPath}`;
}

function readInitialRoute(): RouteState {
  if (typeof window === "undefined") return { screen: "landing" };

  const routeSource = window.location.hash.startsWith("#/")
    ? window.location.hash.slice(1)
    : window.location.pathname;
  const companyMatch = routeSource.match(/^\/company\/([^/]+)\/?$/);
  if (companyMatch?.[1]) {
    return {
      screen: "report",
      companyName: decodeURIComponent(companyMatch[1]).replaceAll("+", " "),
    };
  }

  if (routeSource === "/radar") return { screen: "map" };

  return { screen: "landing" };
}

function updateStandalonePath(screen: Screen, companyName?: string) {
  if (typeof window === "undefined" || isEmbeddedHost()) return;

  const nextUrl = new URL(routeUrl(screen, companyName));
  if (window.location.pathname !== nextUrl.pathname || window.location.hash !== nextUrl.hash) {
    window.history.pushState(null, "", `${nextUrl.pathname}${nextUrl.hash}`);
  }
}

function readDemoMode() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  try {
    return params.get("demo") === "1" || window.localStorage.getItem("corporate-weather-demo") === "1";
  } catch {
    return params.get("demo") === "1";
  }
}

function persistDemoMode(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("corporate-weather-demo", enabled ? "1" : "0");
  } catch {
    // Embedded hosts can block localStorage; demo mode still works in memory.
  }
}

function SearchForm({
  companyName,
  isSearching,
  demoMode,
  label = "Company",
  ctaLabel = "Analyze",
  placeholder = "Try HealthyCo GmbH, RecentLayoff GmbH, or StormAG",
  onCompanyChange,
  onDemoModeChange,
  onSubmit,
}: {
  companyName: string;
  isSearching: boolean;
  demoMode?: boolean;
  label?: string;
  ctaLabel?: string;
  placeholder?: string;
  onCompanyChange: (value: string) => void;
  onDemoModeChange?: (value: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="search-bar" onSubmit={onSubmit}>
      <label>
        <span>{label}</span>
        <input
          value={companyName}
          onChange={(event) => onCompanyChange(event.target.value)}
          placeholder={placeholder}
        />
      </label>
      <button type="submit" disabled={isSearching || !companyName.trim()}>
        {isSearching ? "Scanning" : ctaLabel}
      </button>
      {onDemoModeChange ? (
        <label className="demo-switch" title="Protected demo mode uses calibrated sample evidence.">
          <input
            checked={Boolean(demoMode)}
            type="checkbox"
            onChange={(event) => onDemoModeChange(event.target.checked)}
          />
          <span>Demo mode</span>
        </label>
      ) : null}
    </form>
  );
}

function LandingScreen({
  companyName,
  isSearching,
  demoMode,
  onCompanyChange,
  onDemoModeChange,
  onSubmit,
  onOpenMap,
  onQuickSearch,
}: {
  companyName: string;
  isSearching: boolean;
  demoMode: boolean;
  onCompanyChange: (value: string) => void;
  onDemoModeChange: (value: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onOpenMap: () => void;
  onQuickSearch?: (companyName: string) => void;
}) {
  const starterActions = [
    {
      label: "Check your company weather",
      detail: "Start with any employer name.",
      onClick: () => {
        const target = companyName.trim() || "Personio";
        onCompanyChange(target);
        onQuickSearch?.(target);
      },
    },
    {
      label: "Analyze recent employer signals",
      detail: "Read hiring, sentiment, and restructuring cues.",
      onClick: () => {
        const target = companyName.trim() || "Zalando";
        onCompanyChange(target);
        onQuickSearch?.(target);
      },
    },
    {
      label: "Open DACH Weather Map",
      detail: "Compare demo company weather states.",
      onClick: onOpenMap,
    },
    {
      label: "Try a storm-warning demo",
      detail: "See how high-confidence signals appear.",
      onClick: () => {
        onCompanyChange("StormAG");
        onQuickSearch?.("StormAG");
      },
    },
  ];

  return (
    <main className="risk-shell">
      <section className="landing-hero gpt-start-hero">
        <div className="start-copy">
          <div className="product-mark start-mark">
            <span>CW</span>
            <strong>Corporate Weather</strong>
          </div>
          <h1>Corporate Weather</h1>
          <p className="start-subtitle">
            Decode workplace weather signals across the DACH market.
          </p>
          <p className="start-description">
            Companies rarely announce instability all at once. Corporate Weather reads
            employee sentiment, hiring activity, restructuring signals, and DACH workplace
            indicators to explain what is happening beneath the surface.
          </p>
        </div>

        <SearchForm
          companyName={companyName}
          isSearching={isSearching}
          ctaLabel="Scan company weather"
          placeholder="Search a company, e.g. Personio, Zalando, Delivery Hero"
          onCompanyChange={onCompanyChange}
          demoMode={demoMode}
          onDemoModeChange={onDemoModeChange}
          onSubmit={onSubmit}
        />

        <div className="example-row" aria-label="First run examples">
          {firstRunCompanyNames.map((name) => (
            <button key={name} type="button" onClick={() => onQuickSearch?.(name)}>
              {name}
            </button>
          ))}
        </div>

        <div className="starter-action-grid" aria-label="Starter actions">
          {starterActions.map((action) => (
            <button className="starter-action" key={action.label} type="button" onClick={action.onClick}>
              <span>{action.label}</span>
              <small>{action.detail}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="weather-states" aria-label="Weather state examples">
        {weatherStates.map((state) => (
          <article className={`weather-state ${levelClass[state.name as keyof typeof levelClass]}`} key={state.name}>
            <span>{state.score}</span>
            <h2>{state.name}</h2>
            <p>{state.detail}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

function firstSentence(text: string) {
  const match = text.match(/^.*?[.!?](?:\s|$)/);
  return (match?.[0] ?? text).trim();
}

function findWorkplaceTerms(output: RiskOutput) {
  const evidenceText = output.signals
    .map((signal) => `${signal.title} ${signal.evidence} ${signal.explanation}`)
    .join(" ");

  return workplaceTerms.filter((term) =>
    evidenceText.toLowerCase().includes(term.toLowerCase()),
  );
}

function recencyLabel(recency: keyof typeof scaleLabel) {
  if (recency >= 5) return "Last 30 days";
  if (recency >= 4) return "Last 90 days";
  if (recency >= 1) return "Older signal";
  return "Unknown recency";
}

function shortEvidence(text: string) {
  if (text.length <= 130) return text;
  return `${text.slice(0, 127).trim()}...`;
}

function SignalCard({
  signal,
}: {
  signal: RiskOutput["signals"][number];
}) {
  return (
    <article className="signal-card">
      <div>
        <span>{signal.category}</span>
        <strong>{signal.title}</strong>
      </div>
      <p>{signal.explanation}</p>
      <dl>
        <div>
          <dt>Severity</dt>
          <dd>{scaleLabel[signal.severity]}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{scaleLabel[signal.confidence]}</dd>
        </div>
        <div>
          <dt>Recency</dt>
          <dd>{scaleLabel[signal.recency]}</dd>
        </div>
      </dl>
    </article>
  );
}

function TimelineItem({
  signal,
}: {
  signal: RiskOutput["signals"][number];
}) {
  return (
    <article className="timeline-item">
      <div className="timeline-pin" aria-hidden="true" />
      <div className="timeline-content">
        <div className="timeline-topline">
          <span>{recencyLabel(signal.recency)}</span>
          <span>{signal.category}</span>
        </div>
        <h3>{signal.title}</h3>
        <p>{shortEvidence(signal.evidence)}</p>
        <div className="timeline-indicators">
          <span>Severity: {scaleLabel[signal.severity]}</span>
          <span>Confidence: {scaleLabel[signal.confidence]}</span>
        </div>
      </div>
    </article>
  );
}

function CalmCard({
  signal,
}: {
  signal: RiskOutput["calmSignals"][number];
}) {
  return (
    <article className="signal-card calm-card">
      <div>
        <span>{signal.impact} pts</span>
        <strong>{signal.title}</strong>
      </div>
      <p>{signal.explanation}</p>
    </article>
  );
}

function ReportSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="report-section">
      <div className="section-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function LoadingScreen({ companyName }: { companyName: string }) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessageIndex((index) => (index + 1) % loadingMessages.length);
    }, 1300);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="risk-shell">
      <section className="loading-panel premium-loading">
        <div className="loading-orbit" aria-hidden="true">
          <span />
        </div>
        <div>
          <p className="eyebrow">Corporate Weather</p>
          <h1>Scanning {companyName || "company"}...</h1>
          <p>{loadingMessages[messageIndex]}</p>
        </div>
      </section>
    </main>
  );
}

function DemoFallbackActions({ onOpenCompany }: { onOpenCompany: (companyName: string) => void }) {
  return (
    <div className="demo-fallback">
      <p>Continue with a calibrated demo report:</p>
      <div>
        {fallbackDemoCompanyNames.map((name) => (
          <button key={name} type="button" onClick={() => onOpenCompany(name)}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function confidenceExplanation(output: RiskOutput) {
  if (output.confidence === "High") {
    return "High confidence because the report includes strong company-specific evidence from reliable public or demo-calibrated sources.";
  }

  if (output.confidence === "Medium") {
    return "Medium confidence because visible company-specific signals exist, but formal confirmation or broader corroboration is still limited.";
  }

  return "Low confidence because evidence is limited, indirect, or mostly contextual. The score stays cautious until stronger public signals appear.";
}

function hasUnavailableSources(output: RiskOutput) {
  return output.sourceChecks.some((source) => source.status === "error");
}

function hasLimitedEvidence(output: RiskOutput) {
  return output.signals.length <= 1 || output.confidence === "Low";
}

function SourceTransparency({ output }: { output: RiskOutput }) {
  return (
    <div className="source-transparency">
      <h3>Signals analyzed</h3>
      <div>
        {signalSourcesAnalyzed.map((source) => (
          <span key={source}>{source}</span>
        ))}
      </div>
      {hasUnavailableSources(output) ? (
        <p>Some signal sources were unavailable. Results may be incomplete.</p>
      ) : null}
    </div>
  );
}

function ReportScreen({
  output,
  onBack,
  onOpenMap,
  onOpenDemoCompany,
  onOpenFullReport,
  showFullReportLink,
}: {
  output: RiskOutput;
  onBack: () => void;
  onOpenMap: () => void;
  onOpenDemoCompany: (companyName: string) => void;
  onOpenFullReport: () => void;
  showFullReportLink: boolean;
}) {
  const circumference = 2 * Math.PI * 48;
  const offset = circumference - (output.riskScore / 100) * circumference;
  const employeeSignals = output.signals.filter((signal) => signal.category === "Kununu");
  const detectedTerms = findWorkplaceTerms(output);
  const timelineItems = [...output.signals].sort((first, second) => second.recency - first.recency);

  return (
    <main className="risk-shell">
      <nav className="screen-nav">
        <button type="button" onClick={onBack}>
          Search
        </button>
        <button type="button" onClick={onOpenMap}>
          Open DACH Market Radar
        </button>
        {showFullReportLink ? (
          <button className="external-link" type="button" onClick={onOpenFullReport}>
            Open full report
          </button>
        ) : null}
      </nav>

      <section className={`hero report-hero ${levelClass[output.riskLevel]}`}>
        <div className="hero-copy">
          <p className="eyebrow">Company Weather Report</p>
          <h1>{output.companyName}</h1>
          <div className="report-hero-meta">
            <span>{output.riskLevel}</span>
            <span>Risk {output.riskScore}/100</span>
            <span>{output.confidence} confidence</span>
          </div>
          <p className="summary">{firstSentence(output.summary)}</p>
        </div>

        <div className="score-wrap" aria-label={`Risk score ${output.riskScore} out of 100`}>
          <svg className="score-ring" viewBox="0 0 120 120" role="img">
            <circle className="score-track" cx="60" cy="60" r="48" />
            <circle
              className="score-progress"
              cx="60"
              cy="60"
              r="48"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="score-number">
            <strong>{output.riskScore}</strong>
            <span>/100</span>
          </div>
        </div>
      </section>

      <section className="metric-strip report-metrics" aria-label="Risk summary">
        <div>
          <span>Risk Score</span>
          <strong>{output.riskScore}/100</strong>
        </div>
        <div>
          <span>Weather State</span>
          <strong>{output.riskLevel}</strong>
        </div>
        <div>
          <span>Confidence</span>
          <strong>{output.confidence}</strong>
        </div>
      </section>

      {hasUnavailableSources(output) ? (
        <div className="status-banner">
          Some signal sources were unavailable. Results may be incomplete.
        </div>
      ) : null}

      {hasLimitedEvidence(output) ? (
        <div className="status-banner calm-banner">
          We found limited public signals for this company.
        </div>
      ) : null}

      <SourceTransparency output={output} />

      <button className="radar-link" type="button" onClick={onOpenMap}>
        Open DACH Market Radar
      </button>

      <div className="report-sections">
        <ReportSection eyebrow="Recent movement" title="What Changed Recently">
          {timelineItems.length > 0 ? (
            <div className="timeline-list">
              {timelineItems.map((signal, index) => (
                <TimelineItem key={`${signal.title}-${index}`} signal={signal} />
              ))}
            </div>
          ) : (
            <p className="empty-note">No recent signal cluster detected.</p>
          )}
        </ReportSection>

        <ReportSection eyebrow="Signals" title="Risk Signals">
          <div className="signal-grid">
            {output.signals.length > 0 ? (
              output.signals.map((signal, index) => (
                <SignalCard key={`${signal.title}-${index}`} signal={signal} />
              ))
            ) : (
              <p className="empty-note">
                We found limited public signals for this company.
              </p>
            )}
          </div>
        </ReportSection>

        <ReportSection eyebrow="Confidence" title={`${output.confidence} Confidence`}>
          <p className="empty-note">{confidenceExplanation(output)}</p>
        </ReportSection>

        <ReportSection eyebrow="Calm" title="Calm Signals">
          <div className="signal-grid">
            {output.calmSignals.length > 0 ? (
              output.calmSignals.map((signal) => (
                <CalmCard key={signal.title} signal={signal} />
              ))
            ) : (
              <p className="empty-note">No calm counter-signals reduced the score.</p>
            )}
          </div>
        </ReportSection>

        <ReportSection eyebrow="Employees" title="Employee Signal Clusters">
          {employeeSignals.length > 0 ? (
            <div className="signal-grid">
              {employeeSignals.map((signal, index) => (
                <SignalCard key={`${signal.title}-${index}`} signal={signal} />
              ))}
            </div>
          ) : (
            <p className="empty-note">
              No repeated employee sentiment pattern was surfaced from the current public evidence.
            </p>
          )}
        </ReportSection>

        <ReportSection eyebrow="DACH" title="DACH Legal/Workplace Terms Detected">
          {detectedTerms.length > 0 ? (
            <div className="term-list">
              {detectedTerms.map((term) => (
                <span key={term}>{term}</span>
              ))}
            </div>
          ) : (
            <p className="empty-note">
              No explicit DACH workplace or restructuring terms were detected in the current evidence.
            </p>
          )}
        </ReportSection>

        <ReportSection eyebrow="Coverage" title="Missing Evidence">
          <ul className="plain-list">
            {(output.missingEvidence.length > 0
              ? output.missingEvidence
              : ["No major coverage gaps were listed for this scan."]
            ).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </ReportSection>

        <ReportSection eyebrow="Score" title="Why This Score Is Not Higher">
          <ul className="plain-list">
            {(output.scoreDetails.whyNotHigher.length > 0
              ? output.scoreDetails.whyNotHigher
              : ["No additional guardrail lowered the score beyond the visible evidence."]
            ).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </ReportSection>

        <ReportSection eyebrow="Score" title="Why This Score Is Not Lower">
          <ul className="plain-list">
            {(output.scoreDetails.whyNotLower.length > 0
              ? output.scoreDetails.whyNotLower
              : ["The score remains limited because high-confidence company-specific evidence is not visible."]
            ).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </ReportSection>

        {hasLimitedEvidence(output) ? (
          <ReportSection eyebrow="Demo fallback" title="Need a Complete Demo Report?">
            <DemoFallbackActions onOpenCompany={onOpenDemoCompany} />
          </ReportSection>
        ) : null}
      </div>

      <footer className="risk-footer">Signal analysis only. Not a prediction or legal advice.</footer>
    </main>
  );
}

function MapScreen({
  activeCompany,
  onBack,
  onOpenCompany,
  onOpenRadarPage,
  showFullReportLink,
}: {
  activeCompany?: RiskOutput;
  onBack: () => void;
  onOpenCompany: (companyName: string) => void;
  onOpenRadarPage: () => void;
  showFullReportLink: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<"All" | RiskOutput["riskLevel"]>("All");
  const filteredCompanies =
    activeFilter === "All"
      ? mapCompanies
      : mapCompanies.filter((company) => company.riskLevel === activeFilter);

  return (
    <main className="risk-shell radar-shell">
      <nav className="screen-nav">
        <button type="button" onClick={onBack}>
          Back
        </button>
        {showFullReportLink ? (
          <button className="external-link" type="button" onClick={onOpenRadarPage}>
            Open radar page
          </button>
        ) : null}
      </nav>

      <section className="map-hero radar-hero">
        <div>
          <p className="eyebrow">DACH Weather Radar</p>
          <h1>Workplace stability map</h1>
          <p className="summary">
            A demo portfolio view for visible DACH workplace weather signals. Open any company
            card to inspect the full report.
          </p>
        </div>
        {activeCompany ? (
          <div className={`map-current ${levelClass[activeCompany.riskLevel]}`}>
            <span>{activeCompany.companyName}</span>
            <strong>{activeCompany.riskScore}/100</strong>
            <p>{activeCompany.riskLevel}</p>
          </div>
        ) : null}
      </section>

      <section className="radar-filter" aria-label="Weather filters">
        {(["All", "Clear", "Watchlist", "Cloudy", "Storm Warning"] as const).map((filter) => (
          <button
            className={activeFilter === filter ? "active" : ""}
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </section>

      <section className="radar-layout">
        <div className="radar-board" aria-label="DACH workplace weather radar">
          <div className="radar-grid-lines" />
          {mapCompanies.map((company) => (
            <button
              className={`map-marker ${levelClass[company.riskLevel]}`}
              key={company.name}
              style={{ left: `${company.x}%`, top: `${company.y}%` }}
              type="button"
              aria-label={`Open ${company.name} weather report`}
              onClick={() => onOpenCompany(company.name)}
            >
              <span>{company.riskScore}</span>
            </button>
          ))}
        </div>

        <div className="radar-results">
          <div className="radar-results-header">
            <span>{filteredCompanies.length} companies</span>
            <strong>{activeFilter === "All" ? "All weather states" : activeFilter}</strong>
          </div>
          <div className="radar-card-grid">
            {filteredCompanies.map((company) => (
              <button
                className={`radar-card ${levelClass[company.riskLevel]}`}
                type="button"
                key={company.name}
                onClick={() => onOpenCompany(company.name)}
              >
                <span className="radar-card-label">{company.riskLevel}</span>
                <strong>{company.name}</strong>
                <div className="radar-card-metrics">
                  <span>{company.riskScore}/100</span>
                  <span>{company.confidence} confidence</span>
                </div>
                <p>{company.topSignal}</p>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function HostedRiskDashboard() {
  const toolInfo = useToolInfo<"analyzeCompanyLayoffRisk">();
  const { callTool, data, isPending: isSearching } = useCallTool("analyzeCompanyLayoffRisk");
  const openExternal = useOpenExternal();
  const setOpenInAppUrl = useSetOpenInAppUrl();
  const [initialRoute] = useState(readInitialRoute);
  const [embeddedHost] = useState(isEmbeddedHost);
  const [companyName, setCompanyName] = useState(
    initialRoute.companyName ?? toolInfo.input?.companyName ?? "",
  );
  const [screen, setScreen] = useState<Screen>(
    initialRoute.screen !== "landing" || !toolInfo.input?.companyName ? initialRoute.screen : "report",
  );
  const [searchedOutput, setSearchedOutput] = useState<RiskOutput | undefined>();
  const [demoMode, setDemoModeState] = useState(readDemoMode);
  const [localSearching, setLocalSearching] = useState(false);

  const metadataResult =
    toolInfo.isSuccess && "result" in toolInfo.responseMetadata
      ? (toolInfo.responseMetadata.result as RiskOutput)
      : undefined;
  const dataMetaResult =
    data?.meta && "result" in data.meta ? (data.meta.result as RiskOutput) : undefined;
  const output = searchedOutput ?? dataMetaResult ?? (screen === "report" ? metadataResult : undefined);
  const isBusy = isSearching || localSearching;
  const openInAppTarget = routeUrl(
    screen,
    screen === "report" ? output?.companyName ?? companyName : undefined,
  );

  useEffect(() => {
    if (dataMetaResult) {
      setSearchedOutput(dataMetaResult);
      setScreen("report");
      setCompanyName(dataMetaResult.companyName);
      updateStandalonePath("report", dataMetaResult.companyName);
    }
  }, [dataMetaResult]);

  useEffect(() => {
    if (metadataResult && screen === "report") {
      setCompanyName(metadataResult.companyName);
    }
  }, [metadataResult, screen]);

  useEffect(() => {
    if (initialRoute.screen === "report" && initialRoute.companyName && !metadataResult) {
      callTool({ companyName: initialRoute.companyName });
    }
  }, []);

  // Standalone mode reads clean paths when the host supports them and falls back to
  // `/try#/...` links on Alpic; embedded Skybridge/ChatGPT mode keeps navigation internal
  // and exposes the matching standalone route through the host's "open in app" affordance.
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.skybridge?.hostType !== "apps-sdk" ||
      typeof window.openai?.setOpenInAppUrl !== "function"
    ) {
      return;
    }

    try {
      setOpenInAppUrl(openInAppTarget).catch(() => undefined);
    } catch {
      // Some playground/embedded hosts expose the view without the Apps SDK
      // fullscreen URL API. Ignore that so the dashboard itself still renders.
    }
  }, [openInAppTarget, setOpenInAppUrl]);

  useEffect(() => {
    if (typeof window === "undefined" || embeddedHost) return undefined;

    function handlePopState() {
      const nextRoute = readInitialRoute();
      setScreen(nextRoute.screen);
      if (nextRoute.companyName) {
        setCompanyName(nextRoute.companyName);
        callTool({ companyName: nextRoute.companyName });
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [callTool, embeddedHost]);

  function runCompanySearch(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setCompanyName(trimmedName);
    setScreen("report");
    updateStandalonePath("report", trimmedName);
    setSearchedOutput(undefined);

    if (demoMode) {
      setLocalSearching(true);
      analyzeCompany(trimmedName, { demoMode: true })
        .then((result) => {
          setSearchedOutput(result);
          setCompanyName(result.companyName);
          updateStandalonePath("report", result.companyName);
        })
        .catch(() => analyzeCompany(trimmedName))
        .then((result) => {
          if (result) {
            setSearchedOutput(result);
          }
        })
        .finally(() => setLocalSearching(false));
      return;
    }

    callTool({ companyName: trimmedName });
  }

  function setDemoMode(enabled: boolean) {
    setDemoModeState(enabled);
    persistDemoMode(enabled);
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runCompanySearch(companyName);
  }

  function goToLanding() {
    setScreen("landing");
    updateStandalonePath("landing");
  }

  function goToMap() {
    setScreen("map");
    updateStandalonePath("map");
  }

  function goToReport(reportCompanyName: string) {
    setScreen("report");
    updateStandalonePath("report", reportCompanyName);
  }

  function openFullPage(targetScreen: Screen, targetCompany?: string) {
    openExternal(routeUrl(targetScreen, targetCompany), { redirectUrl: false });
  }

  if (screen === "map") {
    return (
      <MapScreen
        activeCompany={output}
        onBack={() => (output ? goToReport(output.companyName) : goToLanding())}
        onOpenCompany={runCompanySearch}
        onOpenRadarPage={() => openFullPage("map")}
        showFullReportLink={embeddedHost}
      />
    );
  }

  if (screen === "report" && output) {
    return (
      <ReportScreen
        output={output}
        onBack={goToLanding}
        onOpenMap={goToMap}
        onOpenDemoCompany={runCompanySearch}
        onOpenFullReport={() => openFullPage("report", output.companyName)}
        showFullReportLink={embeddedHost}
      />
    );
  }

  if (screen === "report") {
    return <LoadingScreen companyName={companyName} />;
  }

  return (
    <LandingScreen
      companyName={companyName}
      isSearching={isBusy}
      demoMode={demoMode}
      onCompanyChange={setCompanyName}
      onDemoModeChange={setDemoMode}
      onSubmit={submitSearch}
      onOpenMap={goToMap}
      onQuickSearch={runCompanySearch}
    />
  );
}

function StandaloneRiskDashboard() {
  const [initialRoute] = useState(readInitialRoute);
  const [companyName, setCompanyName] = useState(initialRoute.companyName ?? "");
  const [screen, setScreen] = useState<Screen>(initialRoute.screen);
  const [output, setOutput] = useState<RiskOutput | undefined>();
  const [isSearching, setIsSearching] = useState(false);
  const [demoMode, setDemoModeState] = useState(readDemoMode);

  async function runCompanySearch(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setCompanyName(trimmedName);
    setScreen("report");
    setIsSearching(true);
    updateStandalonePath("report", trimmedName);

    try {
      const result = await analyzeCompany(trimmedName, { demoMode });
      setOutput(result);
      setCompanyName(result.companyName);
      updateStandalonePath("report", result.companyName);
    } finally {
      setIsSearching(false);
    }
  }

  function setDemoMode(enabled: boolean) {
    setDemoModeState(enabled);
    persistDemoMode(enabled);
  }

  useEffect(() => {
    if (initialRoute.screen === "report" && initialRoute.companyName) {
      void runCompanySearch(initialRoute.companyName);
    }
  }, []);

  // Standalone mode has no Skybridge host, so it uses local route state plus the
  // same deterministic analyzer instead of host tool calls.
  useEffect(() => {
    function handlePopState() {
      const nextRoute = readInitialRoute();
      setScreen(nextRoute.screen);
      if (nextRoute.companyName) {
        void runCompanySearch(nextRoute.companyName);
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runCompanySearch(companyName);
  }

  function goToLanding() {
    setScreen("landing");
    updateStandalonePath("landing");
  }

  function goToMap() {
    setScreen("map");
    updateStandalonePath("map");
  }

  function goToReport(reportCompanyName: string) {
    setScreen("report");
    updateStandalonePath("report", reportCompanyName);
  }

  if (screen === "map") {
    return (
      <MapScreen
        activeCompany={output}
        onBack={() => (output ? goToReport(output.companyName) : goToLanding())}
        onOpenCompany={runCompanySearch}
        onOpenRadarPage={goToMap}
        showFullReportLink={false}
      />
    );
  }

  if (screen === "report" && output) {
    return (
      <ReportScreen
        output={output}
        onBack={goToLanding}
        onOpenMap={goToMap}
        onOpenDemoCompany={runCompanySearch}
        onOpenFullReport={() => undefined}
        showFullReportLink={false}
      />
    );
  }

  if (screen === "report") {
    return <LoadingScreen companyName={companyName} />;
  }

  return (
    <LandingScreen
      companyName={companyName}
      isSearching={isSearching}
      demoMode={demoMode}
      onCompanyChange={setCompanyName}
      onDemoModeChange={setDemoMode}
      onSubmit={submitSearch}
      onOpenMap={goToMap}
      onQuickSearch={runCompanySearch}
    />
  );
}

export default function RiskDashboard() {
  return hasSkybridgeHost() ? <HostedRiskDashboard /> : <StandaloneRiskDashboard />;
}
