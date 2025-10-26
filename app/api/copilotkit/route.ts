import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime"
import { AzureOpenAI } from "openai"
import { getPipelineMcpTools } from "@/lib/mcp/pipelineTools"

const azureConfig = {
  apiKey: process.env.AZURE_OPENAI_KEY,
  endpoint: process.env.AZURE_ENDPOINT,
  apiVersion: process.env.AZURE_API_VERSION,
  deploymentName: process.env.AZURE_MODEL,
}

const hasAzureConfig = Object.values(azureConfig).every((value) => typeof value === "string" && value.length > 0)

if (!hasAzureConfig) {
  console.error(
    "Azure OpenAI configuration is incomplete. Please set AZURE_OPENAI_KEY, AZURE_ENDPOINT, AZURE_API_VERSION, and AZURE_MODEL."
  )
}

const INTERNAL_PIPELINE_MCP = "internal:pipeline-tools"

const runtime = new CopilotRuntime({
  mcpServers: [{ endpoint: INTERNAL_PIPELINE_MCP }],
  async createMCPClient(config) {
    if (config.endpoint !== INTERNAL_PIPELINE_MCP) {
      throw new Error(`Unsupported MCP endpoint: ${config.endpoint}`)
    }

    return {
      async tools() {
        return getPipelineMcpTools()
      },
      async close() {
        return
      },
    }
  },
})

const azureClient = hasAzureConfig
  ? new AzureOpenAI({
      apiKey: azureConfig.apiKey!,
      endpoint: azureConfig.endpoint!,
      apiVersion: azureConfig.apiVersion!,
    })
  : undefined

const serviceAdapter = azureClient
  ? new OpenAIAdapter({
      openai: azureClient,
      model: azureConfig.deploymentName!,
    })
  : undefined

const missingAzureResponse = () =>
  new Response("Azure OpenAI configuration is missing", {
    status: 500,
  })

const handler = serviceAdapter
  ? copilotRuntimeNextJSAppRouterEndpoint({
      runtime,
      serviceAdapter,
      endpoint: "/api/copilotkit",
    })
  : {
      GET: () => missingAzureResponse(),
      POST: () => missingAzureResponse(),
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            Allow: "GET,POST,OPTIONS",
          },
        }),
    }

export const GET = handler.GET
export const POST = handler.POST
export const OPTIONS = handler.OPTIONS
