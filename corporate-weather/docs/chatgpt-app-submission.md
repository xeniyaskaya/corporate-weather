# Corporate Weather ChatGPT App Submission Pack

Use this document to submit Corporate Weather for public ChatGPT App Directory review.

## Status

Current status: ready for OpenAI Platform draft submission after you provide the publisher identity, support email, privacy-policy URL, and screenshots.

MCP server URL:

```text
https://apps-sdk-template-23c32d77.alpic.live
```

Do not submit `/try` or `/mcp`.

## Required OpenAI Account Prerequisites

- Complete OpenAI Platform identity verification for the individual or business name you want to publish under.
- Use a Platform organization/project with global data residency. Current OpenAI docs say EU data residency projects cannot submit apps for review.
- Ensure your account has `api.apps.write` to create/submit drafts and `api.apps.read` to view review status.

## Directory Listing Copy

App name:

```text
Corporate Weather
```

Short description:

```text
DACH workplace weather radar for visible restructuring and layoff-risk signals.
```

Long description:

```text
Corporate Weather helps users understand visible workplace-weather signals across the DACH market. It turns public, evidence-style signals such as hiring activity, company communications, DACH business press indicators, and workplace review patterns into a calm, explainable report.

The app does not predict layoffs and does not provide legal advice. It highlights visible risk signals, calm counter-signals, confidence, missing evidence, and what to watch next.
```

Category suggestion:

```text
Productivity / Business / Research
```

Support contact:

```text
TODO: add your support email
```

Company/developer URL:

```text
TODO: add your standalone website URL after Vercel deployment
```

Privacy policy URL:

```text
TODO: publish docs/privacy-policy.md and paste its public URL
```

Logo:

```text
public/corporate-weather-icon.svg
```

## Tool Information

Tool: `openCorporateWeather`

Purpose:

```text
Open the Corporate Weather start screen so the user can choose a company scan or the DACH Weather Map.
```

Safety annotations:

```text
readOnlyHint: true
destructiveHint: false
openWorldHint: false
```

Justification:

```text
The tool only renders an internal app start screen. It does not modify external systems, publish content, send messages, or perform destructive actions.
```

Tool: `analyzeCompanyLayoffRisk`

Purpose:

```text
Analyze visible public DACH workplace-weather signals for a named company and render an explainable report.
```

Input:

```json
{
  "companyName": "Zalando"
}
```

Safety annotations:

```text
readOnlyHint: true
destructiveHint: false
openWorldHint: false
```

Justification:

```text
The tool performs read-only signal analysis and returns a report. It does not modify external systems, publish content, send messages, or perform destructive actions.
```

## CSP

The app declares explicit empty CSP allowlists for both Skybridge views because it does not fetch from external browser-side APIs or embed iframes.

```text
connectDomains: []
resourceDomains: []
redirectDomains: []
frameDomains: not used
```

## Test Prompts

Use these in Developer Mode before submitting:

```text
Open Corporate Weather
```

Expected:

```text
The premium Corporate Weather start screen opens with search, starter actions, demo mode, and first-run company examples.
```

```text
Analyze Zalando with Corporate Weather
```

Expected:

```text
The report opens for Zalando with a weather state, risk score, confidence, timeline, risk signals, calm signals, missing evidence, source transparency, and disclaimer.
```

```text
Open the DACH Weather Map in Corporate Weather
```

Expected:

```text
The DACH Weather Radar opens with demo company weather cards and filters for Clear, Watchlist, Cloudy, and Storm Warning.
```

```text
Analyze a company called Unknown Demo GmbH with Corporate Weather
```

Expected:

```text
The app does not crash or show “No results”. It creates a cautious low-confidence report and offers calibrated demo fallback reports.
```

## Review Notes

Suggested notes for the OpenAI review form:

```text
Corporate Weather is a read-only DACH workplace signal analysis app. It does not predict layoffs, does not provide legal advice, and does not modify external systems. The app currently uses deterministic demo/simulated public-signal analysis to demonstrate the product workflow safely and consistently. It asks only for a company name and returns an explainable workplace-weather report with confidence, missing evidence, and guardrails.
```

## Pre-Submission Checks

Run:

```bash
npm run check:demo
npm run build
```

Manual checks:

- Verify the app is connected in ChatGPT Developer Mode with the base MCP URL.
- Use the test prompts above.
- Capture screenshots of the start screen, a company report, and the DACH Weather Radar.
- Confirm no source or UI section appears blank.
- Confirm the disclaimer appears: “Signal analysis only. Not a prediction or legal advice.”

## Submission Steps

1. Go to the OpenAI Platform Dashboard Apps submission area.
2. Create a new app draft.
3. Enter the MCP server URL:

```text
https://apps-sdk-template-23c32d77.alpic.live
```

4. Complete the listing fields using this document.
5. Upload logo and screenshots.
6. Add privacy policy and developer/company URLs.
7. Add the test prompts and expected results.
8. Submit for review.

If OpenAI requests domain verification, use the token from the Platform submission page and paste it into the Alpic Distribution tab under OpenAI Apps Verification Token.
