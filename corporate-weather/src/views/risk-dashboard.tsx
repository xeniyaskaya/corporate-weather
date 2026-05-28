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

export default function RiskDashboard() {
  const toolInfo = useToolInfo<"analyzeCompanyLayoffRisk">();
  const { callTool, data, isPending: isSearching } = useCallTool("analyzeCompanyLayoffRisk");
  const [companyName, setCompanyName] = useState(toolInfo.input?.companyName ?? "");
  const [country, setCountry] = useState<"DE" | "US" | "EU">(
    toolInfo.input?.country ?? "EU",
  );

  if (!toolInfo.isSuccess) {
    return (
      <main className="risk-shell">
        <section className="loading-panel">
          <span className="loading-dot" />
          <div>
            <p className="eyebrow">Corporate Weather</p>
            <h1>Analyzing {toolInfo.input?.companyName ?? "company"}...</h1>
          </div>
        </section>
      </main>
    );
  }

  const output = data?.structuredContent ?? toolInfo.output;
  const circumference = 2 * Math.PI * 48;
  const offset = circumference - (output.riskScore / 100) * circumference;

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = companyName.trim();
    if (!trimmedName) return;
    callTool({
      companyName: trimmedName,
      country: country as "DE" | "US" | "EU",
    });
  }

  return (
    <main className="risk-shell">
      <form className="search-bar" onSubmit={submitSearch}>
        <label>
          <span>Company</span>
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Search company"
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

      <section className="section-block">
        <div className="section-heading">
          <p className="eyebrow">Evidence</p>
          <h2>Signals</h2>
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
            <p className="eyebrow">Next</p>
            <h2>Watch Next</h2>
          </div>
          <ul>
            {output.watchNext.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="risk-footer">
        Signal analysis only. Not a prediction or legal advice.
      </footer>
    </main>
  );
}
