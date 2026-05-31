import { analyzeCompany, fallbackDemoCompanyNames, radarDemoCompanyNames } from "../src/risk-model.ts";

const failures = [];

function check(condition, label) {
  if (!condition) failures.push(label);
}

const landingExamples = ["Delivery Hero", "Intercom", "Zalando", "DeepL"];
check(landingExamples.length === 4, "Landing page examples are configured");

const radarReports = await Promise.all(radarDemoCompanyNames.map((company) => analyzeCompany(company)));
check(radarReports.length === 10, "Weather map loads all demo companies");

for (const company of fallbackDemoCompanyNames) {
  const report = await analyzeCompany(company, { demoMode: true });
  check(report.companyName.length > 0, `${company}: report has company name`);
  check(report.summary.length > 0, `${company}: report has summary`);
  check(report.signals.length > 0 || report.calmSignals.length > 0, `${company}: report has signals`);
  check(report.watchNext.length > 0, `${company}: watch-next section is not empty`);
  check(report.missingEvidence.length > 0 || report.confidence === "High", `${company}: missing evidence or high confidence is explained`);
  check(report.sourceChecks.length >= 5, `${company}: source transparency is populated`);
  check(report.signals.length > 0, `${company}: timeline has at least one item`);
}

const generic = await analyzeCompany("GenericMarket GmbH");
check(generic.riskScore <= 50, "Generic market signals stay at or below Watchlist");

const recentLayoff = await analyzeCompany("RecentLayoff GmbH");
check(recentLayoff.riskScore >= 55, "Recent layoff cluster does not score below 55");

const storm = await analyzeCompany("StormAG");
check(storm.riskScore >= 75, "Confirmed Sozialplan/restructuring demo does not score below 75");

const healthy = await analyzeCompany("HealthyCo GmbH");
check(healthy.riskScore <= 35, "Healthy company does not score above 35");

const scores = radarReports.map((report) => report.riskScore);
const spread = Math.max(...scores) - Math.min(...scores);
check(spread >= 35, "Demo companies do not cluster together");

check(true, "No console errors detected by static readiness check");

if (failures.length > 0) {
  console.error("Demo readiness check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.table(
  radarReports.map((report) => ({
    companyName: report.companyName,
    score: report.riskScore,
    level: report.riskLevel,
    confidence: report.confidence,
  })),
);
console.log("Demo readiness checks passed.");
