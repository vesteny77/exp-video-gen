import { AzureOpenAI } from "openai"

type AzureConfig = {
  apiKey?: string
  endpoint?: string
  apiVersion?: string
  deploymentName?: string
}

const azureConfig: AzureConfig = {
  apiKey: process.env.AZURE_OPENAI_KEY,
  endpoint: process.env.AZURE_ENDPOINT,
  apiVersion: process.env.AZURE_API_VERSION,
  deploymentName: process.env.AZURE_MODEL,
}

let cachedClient: AzureOpenAI | null | undefined

export function getAzureClient(): AzureOpenAI | null {
  if (cachedClient !== undefined) {
    return cachedClient
  }

  if (
    !azureConfig.apiKey ||
    !azureConfig.endpoint ||
    !azureConfig.apiVersion ||
    !azureConfig.deploymentName
  ) {
    cachedClient = null
    return cachedClient
  }

  cachedClient = new AzureOpenAI({
    apiKey: azureConfig.apiKey,
    endpoint: azureConfig.endpoint,
    apiVersion: azureConfig.apiVersion,
  })

  return cachedClient
}

export function getAzureDeploymentName(): string | null {
  return azureConfig.deploymentName ?? null
}
