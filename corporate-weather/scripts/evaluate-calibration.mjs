import { analyzeCompany } from "../src/risk-model.ts";

const expectedRanges = [
  ["HealthyCo GmbH", 18, 28],
  ["NormalSaaS GmbH", 32, 42],
  ["WatchlistTech GmbH", 43, 52],
  ["RecentLayoff GmbH", 58, 72],
  ["StormAG", 80, 94],
];

const failures = [];
const results = expectedRanges.map(([companyName, min, max]) => {
  const report = analyzeCompany(companyName, "DACH");
  if (report.riskScore < min || report.riskScore > max) {
    failures.push(`${companyName} scored ${report.riskScore}; expected ${min}-${max}.`);
  }
  return {
    companyName,
    score: report.riskScore,
    level: report.riskLevel,
    expected: `${min}-${max}`,
  };
});

const generic = analyzeCompany("GenericMarket GmbH", "DACH");
if (generic.riskScore > 50) {
  failures.push(`Generic market scan scored ${generic.riskScore}; expected <= 50.`);
}

const recentLayoff = analyzeCompany("RecentLayoff GmbH", "DE");
if (recentLayoff.riskScore < 55) {
  failures.push(`Recent layoff cluster scored ${recentLayoff.riskScore}; expected >= 55.`);
}

const storm = analyzeCompany("StormAG", "DE");
if (storm.riskScore < 75) {
  failures.push(`Confirmed Sozialplan scenario scored ${storm.riskScore}; expected >= 75.`);
}

const healthy = analyzeCompany("HealthyCo GmbH", "DE");
if (healthy.riskScore > 35) {
  failures.push(`Healthy company scored ${healthy.riskScore}; expected <= 35.`);
}

const scores = results.map((result) => result.score);
const spread = Math.max(...scores) - Math.min(...scores);
if (spread < 45) {
  failures.push(`Mock scores cluster too tightly; spread is only ${spread} points.`);
}

console.table(results);

if (failures.length > 0) {
  console.error("\nCalibration failures:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("\nCalibration checks passed.");
