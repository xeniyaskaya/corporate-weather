import { McpServer } from "skybridge/server";
import { z } from "zod";

import { analyzeCompany } from "./risk-model.js";

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
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
    view: {
      component: "risk-dashboard",
      description:
        "Corporate Weather dashboard. The widget is the full user-facing report; do not repeat, summarize, or explain the results in chat text.",
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
      _meta: {
        result: structuredContent,
        "openai/assistantInstructions":
          "Do not write any prose after this tool call. The Corporate Weather widget is the complete response.",
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
