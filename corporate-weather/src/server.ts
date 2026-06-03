import { McpServer } from "skybridge/server";
import { z } from "zod";

import { analyzeCompany, riskOutputSchema } from "./risk-model.js";

const server = new McpServer(
  {
    name: "Corporate Weather",
    version: "0.0.1",
  },
  { capabilities: {} },
).registerTool(
  {
    name: "analyzeCompanyLayoffRisk",
    title: "Analyze DACH workplace weather",
    description:
      "Analyze visible public DACH layoff-risk signals and render the result only in the Corporate Weather dashboard. Do not summarize the result in chat text. This does not predict layoffs or provide legal advice.",
    inputSchema: {
      companyName: z.string().min(1).describe("Company name to analyze"),
    },
    outputSchema: riskOutputSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
    view: {
      component: "risk-dashboard",
      description:
        "Corporate Weather dashboard. The widget is the full user-facing report; do not repeat, summarize, or explain the results in chat text.",
      csp: {
        connectDomains: [],
        resourceDomains: [],
        redirectDomains: [],
      },
      prefersBorder: true,
    },
    _meta: {
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Checking DACH workplace weather",
      "openai/toolInvocation/invoked": "Corporate Weather dashboard ready",
    },
  },
  async ({ companyName }) => {
    const structuredContent = await analyzeCompany(companyName.trim());

    return {
      structuredContent,
      _meta: {
        result: structuredContent,
        "openai/assistantInstructions":
          "Do not write any prose after this tool call. The Corporate Weather widget is the complete response.",
      },
      content: [],
    };
  },
).registerTool(
  {
    name: "openCorporateWeather",
    title: "Open Corporate Weather",
    description:
      "Open the Corporate Weather start screen so the user can choose a company scan or the DACH Weather Map. Use this when the user wants to start, explore, or open the app without naming a company.",
    inputSchema: {},
    outputSchema: {
      screen: z.literal("landing"),
      message: z.string(),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
    view: {
      component: "corporate-weather-start",
      description:
        "Corporate Weather premium start screen with starter actions, search, and DACH Weather Map access.",
      csp: {
        connectDomains: [],
        resourceDomains: [],
        redirectDomains: [],
      },
      prefersBorder: true,
    },
    _meta: {
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Opening Corporate Weather",
      "openai/toolInvocation/invoked": "Corporate Weather ready",
    },
  },
  async () => {
    const structuredContent = {
      screen: "landing" as const,
      message: "Corporate Weather start screen ready.",
    };

    return {
      structuredContent,
      _meta: {
        "openai/assistantInstructions":
          "Do not write prose after this tool call. The Corporate Weather widget is the complete response.",
      },
      content: [],
    };
  },
);

if (process.env.NODE_ENV === "production") {
  const { default: manifest } = await import("./vite-manifest.js");
  server.setViteManifest(manifest);
}

export default await server.run();

export type AppType = typeof server;
