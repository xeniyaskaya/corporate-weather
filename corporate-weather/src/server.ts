import { McpServer } from "skybridge/server";
import { z } from "zod";

import { analyzeCompany } from "./risk-model.js";

const dashboardStatusSchema = {
  companyName: z.string(),
  dashboardStatus: z.literal("ready"),
};

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
      "Analyze visible public DACH layoff-risk signals and produce a cautious workplace weather report. This does not predict layoffs or provide legal advice.",
    inputSchema: {
      companyName: z.string().min(1).describe("Company name to analyze"),
    },
    outputSchema: dashboardStatusSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
    view: {
      component: "risk-dashboard",
      description: "RiskDashboard",
      prefersBorder: true,
    },
    _meta: {
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Checking DACH workplace weather",
      "openai/toolInvocation/invoked": "DACH workplace weather analyzed",
    },
  },
  async ({ companyName }) => {
    const structuredContent = await analyzeCompany(companyName.trim());

    return {
      structuredContent: {
        companyName: structuredContent.companyName,
        dashboardStatus: "ready" as const,
      },
      _meta: {
        result: structuredContent,
      },
      content: [
        {
          type: "text",
          text: `Corporate Weather dashboard opened for ${structuredContent.companyName}.`,
        },
      ],
    };
  },
);

if (process.env.NODE_ENV === "production") {
  const { default: manifest } = await import("./vite-manifest.js");
  server.setViteManifest(manifest);
}

export default await server.run();

export type AppType = typeof server;
