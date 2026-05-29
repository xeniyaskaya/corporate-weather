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
    note: "Employee signal cluster",
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
  employeeLayoffClusters: Array<{
    title: string;
    postCount: number;
    timeWindow: string;
    severity: keyof typeof scaleLabel;
    confidence: keyof typeof scaleLabel;
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
  onCompanyChange,
  onSubmit,
}: {
  companyName: string;
  isSearching: boolean;
  label?: string;
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
          placeholder="Try HealthyCo GmbH, RecentLayoff GmbH, or StormAG"
        />
      </label>
      <button type="submit" disabled={isSearching || !companyName.trim()}>
        {isSearching ? "Analyzing" : "Analyze"}
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
        <p className="eyebrow">Corporate Weather</p>
        <h1>DACH workplace weather from public signals</h1>
        <p className="summary">
          Search a company to see visible risk signals, employee clusters, source coverage,
          and calm counter-signals.
        </p>
        <SearchForm
          companyName={companyName}
          isSearching={isSearching}
          onCompanyChange={onCompanyChange}
          onSubmit={onSubmit}
        />
        <button className="secondary-action" type="button" onClick={onOpenMap}>
          Open DACH Weather Map
        </button>
      </section>

      <section className="landing-grid">
        <article>
          <span>01</span>
          <h2>Search</h2>
          <p>Start with a company name and run the public-signal scan.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Read the Weather</h2>
          <p>Review risk signals, calm signals, missing evidence, and source checks.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Scan the Map</h2>
          <p>Compare calibrated DACH examples and open a report from the map.</p>
        </article>
      </section>
    </main>
  );
}

function ReportScreen({
  output,
  companyName,
  isSearching,
  onCompanyChange,
  onSubmit,
  onBack,
  onOpenMap,
}: {
  output: RiskOutput;
  companyName: string;
  isSearching: boolean;
  onCompanyChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onOpenMap: () => void;
}) {
  const circumference = 2 * Math.PI * 48;
  const offset = circumference - (output.riskScore / 100) * circumference;
  const linkedInSourceCheck = output.sourceChecks.find((check) =>
    check.source.toLowerCase().includes("linkedin"),
  );

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

      <SearchForm
        companyName={companyName}
        isSearching={isSearching}
        onCompanyChange={onCompanyChange}
        onSubmit={onSubmit}
      />

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

      <section className="metric-strip" aria-label="Risk summary">
        <div>
          <span>Risk</span>
          <strong>{output.riskScore}/100</strong>
        </div>
        <div>
          <span>Confidence</span>
          <strong>{output.confidence}</strong>
        </div>
        <div>
          <span>Employee Clusters</span>
          <strong>{output.employeeLayoffClusters.length}</strong>
        </div>
      </section>

      <section className="section-block explanation-block">
        <div className="section-heading">
          <p className="eyebrow">Score</p>
          <h2>Why This Score</h2>
        </div>
        <p>{output.summary}</p>
        <div className="score-ledger">
          <div>
            <span>Risk signals before calm modifiers</span>
            <strong>{output.scoreDetails.rawRiskScore}</strong>
          </div>
          <div>
            <span>Calm modifiers</span>
            <strong>{output.scoreDetails.calmModifierTotal}</strong>
          </div>
          <div>
            <span>Final guarded score</span>
            <strong>{output.scoreDetails.guardrailAdjustedScore}</strong>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <p className="eyebrow">Risk</p>
          <h2>Risk Signals</h2>
        </div>
        <div className="signal-list">
          {output.signals.map((signal, index) => (
            <article className="signal-item" key={`${signal.category}-${signal.title}-${index}`}>
              <div className="signal-topline">
                <span className={`severity severity-${signal.severity}`}>
                  {scaleLabel[signal.severity]}
                </span>
                <span>{signal.category}</span>
              </div>
              <h3>{signal.title}</h3>
              <dl className="signal-metrics">
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
                <div>
                  <dt>Reliability</dt>
                  <dd>{scaleLabel[signal.sourceReliability]}</dd>
                </div>
              </dl>
              <p className="evidence">{signal.evidence}</p>
              <div className="why-panel">
                <span>Why it matters</span>
                <p>{signal.explanation}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="two-column">
        <div className="section-block compact">
          <div className="section-heading">
            <p className="eyebrow">Employees</p>
            <h2>Employee Signal Clusters</h2>
          </div>
          {output.employeeLayoffClusters.length === 0 ? (
            <p>
              {linkedInSourceCheck?.summary ??
                "LinkedIn employee clusters were not verified by the current source access. Treat this as missing evidence, not proof that no employee posts exist."}
            </p>
          ) : (
            <div className="cluster-list">
              {output.employeeLayoffClusters.map((cluster, index) => (
                <article className="cluster-item" key={`${cluster.title}-${index}`}>
                  <div className="calm-topline">
                    <span>{cluster.postCount} posts</span>
                    <strong>{cluster.timeWindow}</strong>
                  </div>
                  <h3>{cluster.title}</h3>
                  <dl className="signal-metrics">
                    <div>
                      <dt>Severity</dt>
                      <dd>{scaleLabel[cluster.severity]}</dd>
                    </div>
                    <div>
                      <dt>Confidence</dt>
                      <dd>{scaleLabel[cluster.confidence]}</dd>
                    </div>
                  </dl>
                  <p>{cluster.evidence}</p>
                  <p>{cluster.explanation}</p>
                </article>
              ))}
            </div>
          )}
          {linkedInSourceCheck ? (
            <div className="source-check">
              <span>{linkedInSourceCheck.status.replace("_", " ")}</span>
              <strong>{linkedInSourceCheck.provider ?? "no provider"}</strong>
              <p>
                {linkedInSourceCheck.queryCount} queries, {linkedInSourceCheck.resultCount} matching results
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <p className="eyebrow">Calm</p>
          <h2>Positive / Calm Signals</h2>
        </div>
        <div className="calm-list">
          {output.calmSignals.length === 0 ? (
            <article className="calm-item">
              <h3>No calm counter-signals found</h3>
              <p>The score was not reduced by visible hiring, growth, or missing-evidence counter-signals.</p>
            </article>
          ) : (
            output.calmSignals.map((signal, index) => (
              <article className="calm-item" key={`${signal.title}-${index}`}>
                <div className="calm-topline">
                  <span>{signal.impact}</span>
                  <strong>{signal.title}</strong>
                </div>
                <p>{signal.evidence}</p>
                <p>{signal.explanation}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="two-column">
        <div className="section-block compact">
          <div className="section-heading">
            <p className="eyebrow">Coverage</p>
            <h2>Missing Evidence</h2>
          </div>
          <ul>
            {output.missingEvidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="section-block compact">
          <div className="section-heading">
            <p className="eyebrow">Guardrail</p>
            <h2>Why Not Higher?</h2>
          </div>
          <ul>
            {output.scoreDetails.whyNotHigher.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-block compact">
        <div className="section-heading">
          <p className="eyebrow">Balance</p>
          <h2>Why Not Lower?</h2>
        </div>
        <ul>
          {output.scoreDetails.whyNotLower.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="two-column">
        <div className="section-block compact">
          <div className="section-heading">
            <p className="eyebrow">Next</p>
            <h2>Watch Next</h2>
          </div>
          <ul>
            {output.watchNext.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="section-block compact">
          <div className="section-heading">
            <p className="eyebrow">Caps</p>
            <h2>Category Contributions</h2>
          </div>
          <div className="category-list">
            {output.scoreDetails.categoryContributions.map((item) => (
              <div key={item.category}>
                <span>{item.category}</span>
                <strong>
                  {item.contribution}/{item.cap}
                </strong>
              </div>
            ))}
          </div>
        </div>
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

  const metadataResult =
    toolInfo.isSuccess && "result" in toolInfo.responseMetadata
      ? (toolInfo.responseMetadata.result as RiskOutput)
      : undefined;
  const output = (data?.structuredContent ?? (toolInfo.isSuccess ? toolInfo.output : undefined) ?? metadataResult) as
    | RiskOutput
    | undefined;

  useEffect(() => {
    if (output) {
      setScreen("report");
      setCompanyName(output.companyName);
    }
  }, [output]);

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
        companyName={companyName}
        isSearching={isSearching}
        onCompanyChange={setCompanyName}
        onSubmit={submitSearch}
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
