import "./index.css";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { analyzeCompany, type RiskOutput } from "./risk-model.js";

type Screen = "landing" | "report" | "radar";

const demoCompanies = [
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
];

const levelClass: Record<RiskOutput["riskLevel"], string> = {
  Clear: "level-clear",
  Watchlist: "level-watchlist",
  Cloudy: "level-cloudy",
  "Storm Warning": "level-storm",
};

const weatherStates = [
  ["0-25", "Clear", "Limited visible public risk signals"],
  ["26-50", "Watchlist", "Weak or early signals need monitoring"],
  ["51-75", "Cloudy", "Recent company-specific evidence appears"],
  ["76-100", "Storm Warning", "Strong public restructuring evidence"],
];

function readRoute() {
  const companyMatch = window.location.pathname.match(/^\/company\/([^/]+)\/?$/);

  if (companyMatch?.[1]) {
    return {
      screen: "report" as const,
      companyName: decodeURIComponent(companyMatch[1]).replaceAll("+", " "),
    };
  }

  if (window.location.pathname === "/radar") {
    return { screen: "radar" as const };
  }

  return { screen: "landing" as const };
}

function routePath(screen: Screen, companyName?: string) {
  if (screen === "radar") return "/radar";
  if (screen === "report" && companyName) return `/company/${encodeURIComponent(companyName)}`;
  return "/";
}

function firstSentence(text: string) {
  const match = text.match(/^.*?[.!?](\s|$)/);
  return match ? match[0].trim() : text;
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="empty-note">{children}</p>;
}

function LandingScreen({
  companyName,
  isSearching,
  onCompanyChange,
  onSearch,
  onOpenRadar,
}: {
  companyName: string;
  isSearching: boolean;
  onCompanyChange: (value: string) => void;
  onSearch: (companyName: string) => void;
  onOpenRadar: () => void;
}) {
  return (
    <main className="risk-shell standalone-shell">
      <section className="landing-hero">
        <div className="product-mark">
          <span>CW</span>
          <strong>Corporate Weather</strong>
        </div>
        <h1>Corporate Weather</h1>
        <p className="summary">
          DACH workplace weather radar for visible restructuring and layoff-risk signals.
        </p>

        <form
          className="search-bar"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch(companyName);
          }}
        >
          <label>
            <span>Company</span>
            <input
              value={companyName}
              onChange={(event) => onCompanyChange(event.target.value)}
              placeholder="Search a company, e.g. Personio, Zalando, Delivery Hero"
            />
          </label>
          <button type="submit" disabled={isSearching || !companyName.trim()}>
            {isSearching ? "Scanning" : "Scan company weather"}
          </button>
        </form>

        <button className="secondary-action" type="button" onClick={onOpenRadar}>
          Open DACH Weather Map
        </button>
      </section>

      <section className="weather-states" aria-label="Weather states">
        {weatherStates.map(([score, name, detail]) => (
          <article className={`weather-state ${levelClass[name as RiskOutput["riskLevel"]]}`} key={name}>
            <span>{score}</span>
            <strong>{name}</strong>
            <p>{detail}</p>
          </article>
        ))}
      </section>
    </main>
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

function SignalCard({ signal }: { signal: RiskOutput["signals"][number] }) {
  return (
    <article className="signal-card">
      <div>
        <span>{signal.category}</span>
        <strong>{signal.title}</strong>
      </div>
      <p>{signal.explanation}</p>
      <small>{signal.evidence}</small>
    </article>
  );
}

function ReportScreen({
  output,
  onBack,
  onOpenRadar,
}: {
  output: RiskOutput;
  onBack: () => void;
  onOpenRadar: () => void;
}) {
  const legalTerms = useMemo(() => {
    const terms = [
      "Stellenabbau",
      "Entlassungen",
      "Kündigungen",
      "Sozialplan",
      "Interessenausgleich",
      "Massenentlassung",
      "Restrukturierung",
      "Umstrukturierung",
      "Standortschließung",
      "Einstellungsstopp",
      "Kurzarbeit",
      "Sparprogramm",
      "Effizienzprogramm",
    ];
    const evidenceText = JSON.stringify(output).toLowerCase();
    return terms.filter((term) => evidenceText.includes(term.toLowerCase()));
  }, [output]);

  const employeeSignals = output.signals.filter((signal) => signal.category === "Kununu");

  return (
    <main className="risk-shell standalone-shell">
      <nav className="screen-nav">
        <button type="button" onClick={onBack}>
          Search
        </button>
        <button type="button" onClick={onOpenRadar}>
          Open DACH Weather Map
        </button>
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

      <div className="report-sections">
        <ReportSection eyebrow="Signals" title="Risk Signals">
          <div className="signal-grid">
            {output.signals.length > 0 ? (
              output.signals.map((signal, index) => (
                <SignalCard signal={signal} key={`${signal.title}-${index}`} />
              ))
            ) : (
              <EmptyNote>No visible risk signals were surfaced in this scan.</EmptyNote>
            )}
          </div>
        </ReportSection>

        <ReportSection eyebrow="Calm" title="Calm Signals">
          <div className="signal-grid">
            {output.calmSignals.length > 0 ? (
              output.calmSignals.map((signal) => (
                <article className="signal-card calm-card" key={signal.title}>
                  <div>
                    <span>{signal.impact} pts</span>
                    <strong>{signal.title}</strong>
                  </div>
                  <p>{signal.explanation}</p>
                </article>
              ))
            ) : (
              <EmptyNote>No calm counter-signals reduced the score.</EmptyNote>
            )}
          </div>
        </ReportSection>

        <ReportSection eyebrow="Employees" title="Employee Signal Clusters">
          <div className="signal-grid">
            {employeeSignals.length > 0 ? (
              employeeSignals.map((signal, index) => (
                <SignalCard signal={signal} key={`${signal.title}-${index}`} />
              ))
            ) : (
              <EmptyNote>No repeated employee sentiment pattern was surfaced.</EmptyNote>
            )}
          </div>
        </ReportSection>

        <ReportSection eyebrow="DACH" title="DACH Legal/Workplace Terms Detected">
          {legalTerms.length > 0 ? (
            <div className="term-list">
              {legalTerms.map((term) => (
                <span key={term}>{term}</span>
              ))}
            </div>
          ) : (
            <EmptyNote>No explicit DACH workplace or restructuring terms were detected.</EmptyNote>
          )}
        </ReportSection>

        <ReportSection eyebrow="Coverage" title="Missing Evidence">
          <ul className="plain-list">
            {output.missingEvidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </ReportSection>

        <ReportSection eyebrow="Score" title="Why This Score Is Not Higher">
          <ul className="plain-list">
            {output.scoreDetails.whyNotHigher.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </ReportSection>

        <ReportSection eyebrow="Score" title="Why This Score Is Not Lower">
          <ul className="plain-list">
            {output.scoreDetails.whyNotLower.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </ReportSection>
      </div>

      <footer className="risk-footer">Signal analysis only. Not a prediction or legal advice.</footer>
    </main>
  );
}

function RadarScreen({
  companies,
  activeFilter,
  onBack,
  onFilter,
  onOpenCompany,
}: {
  companies: RiskOutput[];
  activeFilter: "All" | RiskOutput["riskLevel"];
  onBack: () => void;
  onFilter: (value: "All" | RiskOutput["riskLevel"]) => void;
  onOpenCompany: (companyName: string) => void;
}) {
  const filteredCompanies =
    activeFilter === "All"
      ? companies
      : companies.filter((company) => company.riskLevel === activeFilter);

  return (
    <main className="risk-shell radar-shell standalone-shell">
      <nav className="screen-nav">
        <button type="button" onClick={onBack}>
          Search
        </button>
      </nav>

      <section className="map-hero radar-hero">
        <div>
          <p className="eyebrow">DACH Weather Map</p>
          <h1>Workplace stability radar</h1>
          <p className="summary">
            A demo portfolio view for visible DACH workplace weather signals.
          </p>
        </div>
      </section>

      <section className="radar-filter" aria-label="Weather filters">
        {(["All", "Clear", "Watchlist", "Cloudy", "Storm Warning"] as const).map((filter) => (
          <button
            className={activeFilter === filter ? "active" : ""}
            key={filter}
            type="button"
            onClick={() => onFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </section>

      <section className="radar-card-grid standalone-radar-grid">
        {filteredCompanies.map((company) => (
          <button
            className={`radar-card ${levelClass[company.riskLevel]}`}
            type="button"
            key={company.companyName}
            onClick={() => onOpenCompany(company.companyName)}
          >
            <span className="radar-card-label">{company.riskLevel}</span>
            <strong>{company.companyName}</strong>
            <div className="radar-card-metrics">
              <span>{company.riskScore}/100</span>
              <span>{company.confidence} confidence</span>
            </div>
            <p>{outputTopSignal(company)}</p>
          </button>
        ))}
      </section>
    </main>
  );
}

function outputTopSignal(output: RiskOutput) {
  return output.signals[0]?.title ?? output.calmSignals[0]?.title ?? "No dominant signal surfaced";
}

function StandaloneWebsite() {
  const initialRoute = useMemo(readRoute, []);
  const [screen, setScreen] = useState<Screen>(initialRoute.screen);
  const [companyName, setCompanyName] = useState(initialRoute.companyName ?? "");
  const [output, setOutput] = useState<RiskOutput | undefined>();
  const [radarCompanies, setRadarCompanies] = useState<RiskOutput[]>([]);
  const [activeFilter, setActiveFilter] = useState<"All" | RiskOutput["riskLevel"]>("All");
  const [isSearching, setIsSearching] = useState(false);

  async function openCompany(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setIsSearching(true);
    setScreen("report");
    setCompanyName(trimmedName);
    window.history.pushState(null, "", routePath("report", trimmedName));

    try {
      const result = await analyzeCompany(trimmedName);
      setOutput(result);
      setCompanyName(result.companyName);
      window.history.replaceState(null, "", routePath("report", result.companyName));
    } finally {
      setIsSearching(false);
    }
  }

  function openLanding() {
    setScreen("landing");
    window.history.pushState(null, "", routePath("landing"));
  }

  function openRadar() {
    setScreen("radar");
    window.history.pushState(null, "", routePath("radar"));
  }

  useEffect(() => {
    Promise.all(demoCompanies.map((company) => analyzeCompany(company))).then(setRadarCompanies);
  }, []);

  useEffect(() => {
    if (initialRoute.screen === "report" && initialRoute.companyName) {
      void openCompany(initialRoute.companyName);
    }
  }, []);

  useEffect(() => {
    function handlePopState() {
      const nextRoute = readRoute();
      setScreen(nextRoute.screen);
      if (nextRoute.companyName) {
        void openCompany(nextRoute.companyName);
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (screen === "radar") {
    return (
      <RadarScreen
        activeFilter={activeFilter}
        companies={radarCompanies}
        onBack={openLanding}
        onFilter={setActiveFilter}
        onOpenCompany={openCompany}
      />
    );
  }

  if (screen === "report" && output) {
    return <ReportScreen output={output} onBack={openLanding} onOpenRadar={openRadar} />;
  }

  if (screen === "report") {
    return (
      <main className="risk-shell standalone-shell">
        <section className="loading-panel">
          <div className="loading-dot" />
          <div>
            <p className="eyebrow">Corporate Weather</p>
            <h1>{isSearching ? "Scanning" : "Preparing"} {companyName || "company"}...</h1>
          </div>
        </section>
      </main>
    );
  }

  return (
    <LandingScreen
      companyName={companyName}
      isSearching={isSearching}
      onCompanyChange={setCompanyName}
      onSearch={openCompany}
      onOpenRadar={openRadar}
    />
  );
}

createRoot(document.getElementById("root")!).render(<StandaloneWebsite />);
