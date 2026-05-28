import "../index.css";
import { useState } from "react";
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
    evidence: string;
    explanation: string;
  }>;
  calmSignals: Array<{
    title: string;
    impact: number;
    evidence: string;
    explanation: string;
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
    categoryContributions: Array<{
      category: string;
      contribution: number;
      cap: number;
    }>;
  };
};

export default function RiskDashboard() {
  const toolInfo = useToolInfo<"analyzeCompanyLayoffRisk">();
  const { callTool, data, isPending: isSearching } = useCallTool("analyzeCompanyLayoffRisk");
  const [companyName, setCompanyName] = useState(toolInfo.input?.companyName ?? "");
  const [country, setCountry] = useState<"DE" | "US" | "EU">(
    toolInfo.input?.country ?? "EU",
  );

  const metadataResult =
    toolInfo.isSuccess && "result" in toolInfo.responseMetadata
      ? (toolInfo.responseMetadata.result as RiskOutput)
      : undefined;
  const output = (data?.structuredContent ?? (toolInfo.isSuccess ? toolInfo.output : undefined) ?? metadataResult) as
    | RiskOutput
    | undefined;

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = companyName.trim();
    if (!trimmedName) return;
    callTool({
      companyName: trimmedName,
      country: country as "DE" | "US" | "EU",
    });
  }

  const searchBar = (
    <form className="search-bar" onSubmit={submitSearch}>
      <label>
        <span>Company</span>
        <input
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          placeholder="Try demosoft, scalenow, budgetcloud, or futuremobility"
        />
      </label>
      <label>
        <span>Market</span>
        <select
          value={country}
          onChange={(event) => setCountry(event.target.value as "DE" | "US" | "EU")}
        >
          <option value="EU">EU</option>
          <option value="DE">DE</option>
          <option value="US">US</option>
        </select>
      </label>
      <button type="submit" disabled={isSearching || !companyName.trim()}>
        {isSearching ? "Analyzing" : "Analyze"}
      </button>
    </form>
  );

  if (!output) {
    return (
      <main className="risk-shell">
        {searchBar}
        <section className="loading-panel">
          <span className="loading-dot" />
          <div>
            <p className="eyebrow">Corporate Weather</p>
            <h1>{isSearching ? "Analyzing company..." : "Search a company"}</h1>
            <p className="summary">
              If the host does not pass tool output into this view, use the search above to
              load the dashboard directly.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const circumference = 2 * Math.PI * 48;
  const offset = circumference - (output.riskScore / 100) * circumference;

  return (
    <main className="risk-shell">
      {searchBar}

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
          <span>Signals</span>
          <strong>{output.signals.length}</strong>
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
            <h2>Coverage Notes</h2>
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

      <footer className="risk-footer">
        Signal analysis only. Not a prediction or legal advice.
      </footer>
    </main>
  );
}
