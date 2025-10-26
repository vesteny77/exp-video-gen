"use client"

import { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { CopilotKit } from "@copilotkit/react-core"
import { CopilotSidebar } from "@copilotkit/react-ui"
import "@copilotkit/react-ui/styles.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <CopilotKit runtimeUrl="/api/copilotkit">
        {children}
      </CopilotKit>
    </QueryClientProvider>
  )
}