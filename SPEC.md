# Corporate Weather

## Value Proposition
Corporate Weather helps knowledge workers, employee representatives, and internal strategists quickly assess layoff and restructuring risk for a named company.

The pain today is fragmented evidence: news, careers pages, employee reviews, LinkedIn language, and German legal-process signals are scattered across sources and often hidden behind corporate euphemisms.

**Core action**: Analyze a company for layoff risk and present a concise, evidence-oriented dashboard.

## Why LLM?
**Conversational win**: A user can ask about a company by name instead of assembling search queries and reading scattered pages.

**LLM adds**: The assistant can interpret weak signals, identify euphemisms, explain confidence, and distinguish German labor-process terms from generic restructuring language.

**What LLM lacks**: Live source access may be unavailable in local development, so the app supports a deterministic simulated source collector that mirrors the intended evidence categories.

## UI Overview
**First view**: A risk dashboard showing the company name, score, risk level, confidence, and a short summary.

**Key interactions**: The user asks the assistant to analyze a company. The assistant invokes `analyzeCompanyLayoffRisk`, then opens `RiskDashboard` to visualize the result.

**End state**: The user receives a structured risk readout with signals, missing evidence, and items to watch next.

## Product Context
- **Product**: Skybridge GPT App
- **App name**: Corporate Weather
- **Tool**: `analyzeCompanyLayoffRisk`
- **View**: `RiskDashboard`
- **Authentication**: None for the local prototype
- **Data collection**: Simulated source collector shaped around news, careers pages, employee sentiment, LinkedIn leadership language, and German legal/process signals
- **Differentiation**: Explicit handling of German layoff and works-council terminology such as Sozialplan, Interessenausgleich, Massenentlassung, Betriebsrat, betriebsbedingte Kündigungen, Standortschließung, and Stellenabbau

## UX Flows
Analyze company layoff risk:
1. User provides `companyName` and optional country
2. Tool checks or simulates relevant source categories
3. Tool returns a scored risk assessment
4. `RiskDashboard` renders the assessment visually

## Tools and Views
**Tool: analyzeCompanyLayoffRisk**
- **Input**: `{ companyName: string; country?: "DE" | "US" | "EU" }`
- **Output**: `{ companyName, riskScore, riskLevel, confidence, summary, signals, missingEvidence, watchNext }`
- **Signal shape**: `{ title, category, severity, confidence, recency, evidence, explanation }`
- **Signal score**: `severity * confidence * recency`
- **Total score**: Normalize each signal score to `0-100`, then combine signals with a non-diluting cumulative model so one decisive signal, such as `Sozialplan negotiations found` at `5 * 5 * 5`, can drive a Storm Warning.
- **Risk levels**: `0-25 Clear`, `26-50 Watchlist`, `51-75 Cloudy`, `76-100 Storm Warning`
- **Behavior**: Simulates source collection across news, hiring, employee sentiment, leadership language, and German legal/process indicators. Produces deterministic scoring and confidence.

**View: RiskDashboard**
- **Input**: Same as `analyzeCompanyLayoffRisk`
- **Output**: Same as `analyzeCompanyLayoffRisk`
- **Behavior**: Presents score, risk level, confidence, signals grouped by source, missing evidence, and watch-next items.
