import "../index.css";
import { useEffect, useState } from "react";
import { useCallTool, useToolInfo } from "../helpers.js";

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
    name: "HealthyCo GmbH",
    city: "Hamburg",
    note: "Active hiring and product launch",
    x: 38,
    y: 18,
  },
  {
    name: "NormalSaaS GmbH",
    city: "Berlin",
    note: "Generic tech pressure",
    x: 62,
    y: 28,
  },
  {
    name: "WatchlistTech GmbH",
    city: "Munich",
    note: "Hiring slowdown and Kununu uncertainty",
    x: 70,
    y: 70,
  },
  {
    name: "RecentLayoff GmbH",
    city: "Cologne",
    note: "Recent public workforce signals",
    x: 42,
    y: 56,
  },
  {
    name: "StormAG",
    city: "Stuttgart",
    note: "Public restructuring evidence",
    x: 57,
    y: 76,
  },
];

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

type Screen = "landing" | "report" | "map";

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

function SearchForm({
  companyName,
  isSearching,
  label = "Company",
  ctaLabel = "Analyze",
  placeholder = "Try HealthyCo GmbH, RecentLayoff GmbH, or StormAG",
  onCompanyChange,
  onSubmit,
}: {
  companyName: string;
  isSearching: boolean;
  label?: string;
  ctaLabel?: string;
  placeholder?: string;
  onCompanyChange: (value: string) => void;
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
    </form>
  );
}

function LandingScreen({
  companyName,
  isSearching,
  onCompanyChange,
  onSubmit,
  onOpenMap,
}: {
  companyName: string;
  isSearching: boolean;
  onCompanyChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onOpenMap: () => void;
}) {
  return (
    <main className="risk-shell">
      <section className="landing-hero">
        <div className="product-mark">
          <span>CW</span>
          <strong>Corporate Weather</strong>
        </div>
        <h1>Corporate Weather</h1>
        <p className="summary">
          DACH workplace weather radar for visible restructuring and layoff-risk signals.
        </p>
        <SearchForm
          companyName={companyName}
          isSearching={isSearching}
          ctaLabel="Scan company weather"
          placeholder="Search a company, e.g. Personio, Zalando, Delivery Hero"
          onCompanyChange={onCompanyChange}
          onSubmit={onSubmit}
        />
        <button className="secondary-action" type="button" onClick={onOpenMap}>
          Open DACH Weather Map
        </button>
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

function ReportScreen({
  output,
  onBack,
  onOpenMap,
}: {
  output: RiskOutput;
  onBack: () => void;
  onOpenMap: () => void;
}) {
  const circumference = 2 * Math.PI * 48;
  const offset = circumference - (output.riskScore / 100) * circumference;
  const topSignals = output.signals.slice(0, 3);
  const topCalmSignals = output.calmSignals.slice(0, 2);

  return (
    <main className="risk-shell">
      <nav className="screen-nav">
        <button type="button" onClick={onBack}>
          Search
        </button>
        <button type="button" onClick={onOpenMap}>
          DACH Weather Map
        </button>
      </nav>

      <section className={`hero ${levelClass[output.riskLevel]}`}>
        <div className="hero-copy">
          <p className="eyebrow">{output.companyName}</p>
          <h1>Corporate Weather: {output.riskLevel}</h1>
          <p className="summary">{output.summary}</p>
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
          <span>Risk</span>
          <strong>{output.riskScore}/100</strong>
        </div>
        <div>
          <span>Confidence</span>
          <strong>{output.confidence}</strong>
        </div>
      </section>

      <section className="report-grid">
        <article className="report-panel wide">
          <p className="eyebrow">Reading</p>
          <h2>What Changed the Weather</h2>
          <div className="mini-signal-list">
            {topSignals.map((signal, index) => (
              <div key={`${signal.title}-${index}`}>
                <span>{signal.category}</span>
                <strong>{signal.title}</strong>
                <p>{signal.explanation}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="report-panel">
          <p className="eyebrow">Calm</p>
          <h2>Counter-Signals</h2>
          {topCalmSignals.length > 0 ? (
            <ul>
              {topCalmSignals.map((signal) => (
                <li key={signal.title}>{signal.title}</li>
              ))}
            </ul>
          ) : (
            <p>No calm counter-signals reduced the score.</p>
          )}
        </article>

        <article className="report-panel">
          <p className="eyebrow">Coverage</p>
          <h2>Missing Evidence</h2>
          <p>{output.missingEvidence[0] ?? "No major coverage gaps listed."}</p>
        </article>

        <article className="report-panel">
          <p className="eyebrow">Next</p>
          <h2>Watch Next</h2>
          <p>{output.watchNext[0] ?? "Re-run the scan when new public evidence appears."}</p>
        </article>
      </section>

      <footer className="risk-footer">Signal analysis only. Not a prediction or legal advice.</footer>
    </main>
  );
}

function MapScreen({
  activeCompany,
  onBack,
  onOpenCompany,
}: {
  activeCompany?: RiskOutput;
  onBack: () => void;
  onOpenCompany: (companyName: string) => void;
}) {
  return (
    <main className="risk-shell">
      <nav className="screen-nav">
        <button type="button" onClick={onBack}>
          Back
        </button>
      </nav>

      <section className="map-hero">
        <div>
          <p className="eyebrow">DACH Weather Map</p>
          <h1>Public signal landscape</h1>
          <p className="summary">
            Open a calibrated company report from the map. These examples reuse the same
            scoring model as search.
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

      <section className="map-board" aria-label="DACH company weather map">
        <div className="map-outline" />
        {mapCompanies.map((company) => (
          <button
            className="map-marker"
            key={company.name}
            style={{ left: `${company.x}%`, top: `${company.y}%` }}
            type="button"
            onClick={() => onOpenCompany(company.name)}
          >
            <span>{company.name}</span>
          </button>
        ))}
      </section>

      <section className="map-list">
        {mapCompanies.map((company) => (
          <button type="button" key={company.name} onClick={() => onOpenCompany(company.name)}>
            <span>{company.city}</span>
            <strong>{company.name}</strong>
            <p>{company.note}</p>
          </button>
        ))}
      </section>
    </main>
  );
}

export default function RiskDashboard() {
  const toolInfo = useToolInfo<"analyzeCompanyLayoffRisk">();
  const { callTool, data, isPending: isSearching } = useCallTool("analyzeCompanyLayoffRisk");
  const [companyName, setCompanyName] = useState(toolInfo.input?.companyName ?? "");
  const [screen, setScreen] = useState<Screen>("landing");
  const [searchedOutput, setSearchedOutput] = useState<RiskOutput | undefined>();

  const metadataResult =
    toolInfo.isSuccess && "result" in toolInfo.responseMetadata
      ? (toolInfo.responseMetadata.result as RiskOutput)
      : undefined;
  const dataMetaResult =
    data?.meta && "result" in data.meta ? (data.meta.result as RiskOutput) : undefined;
  const output = searchedOutput ?? dataMetaResult ?? (screen === "report" ? metadataResult : undefined);

  useEffect(() => {
    if (dataMetaResult) {
      setSearchedOutput(dataMetaResult);
      setScreen("report");
      setCompanyName(dataMetaResult.companyName);
    }
  }, [dataMetaResult]);

  function runCompanySearch(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setCompanyName(trimmedName);
    callTool({ companyName: trimmedName });
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runCompanySearch(companyName);
  }

  if (screen === "map") {
    return (
      <MapScreen
        activeCompany={output}
        onBack={() => setScreen(output ? "report" : "landing")}
        onOpenCompany={runCompanySearch}
      />
    );
  }

  if (screen === "report" && output) {
    return (
      <ReportScreen
        output={output}
        onBack={() => setScreen("landing")}
        onOpenMap={() => setScreen("map")}
      />
    );
  }

  return (
    <LandingScreen
      companyName={companyName}
      isSearching={isSearching}
      onCompanyChange={setCompanyName}
      onSubmit={submitSearch}
      onOpenMap={() => setScreen("map")}
    />
  );
}
