// API handlers for pipeline operations wired through MCP tools

async function invokePipelineTool<T = any>(tool: string, parameters: Record<string, any>) {
  try {
    const response = await fetch("/api/tools/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, parameters }),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody.error || `Failed to execute tool ${tool}`)
    }

    const data = await response.json()
    return data.result as T
  } catch (error) {
    console.error(`Pipeline MCP tool error (${tool}):`, error)
    throw error
  }
}

export async function generateScript(
  idea: string,
  options?: { script?: string; instructions?: string },
): Promise<{
  script: string
  wordCount: number
  estimatedDuration: number
} | null> {
  const mode = idea ? "idea_to_script" : "refine_existing"

  try {
    const data = await invokePipelineTool<{
      type: string
      script: string
      wordCount: number
      estimatedDuration: number
    }>("modify_script", {
      mode,
      idea: idea || null,
      script: options?.script ?? null,
      instructions: options?.instructions ?? null,
    })

    return {
      script: data.script,
      wordCount: data.wordCount,
      estimatedDuration: data.estimatedDuration,
    }
  } catch {
    return null
  }
}

export async function generateAudio(script: string, preset: string): Promise<{
  audioUrl: string
  audioPath?: string | null
  duration: number
  preset: string
} | null> {
  try {
    const data = await invokePipelineTool<{
      type: string
      audioUrl: string
      audioPath?: string | null
      duration: number
      preset: string
    }>("generate_audio", {
      script,
      preset,
    })

    return {
      audioUrl: data.audioUrl,
      audioPath: data.audioPath ?? null,
      duration: data.duration,
      preset: data.preset,
    }
  } catch {
    return null
  }
}

export async function generateVideo(
  audioUrl: string,
  avatarId?: string,
  audioPath?: string,
): Promise<{
  jobId: string
  status: string
  message?: string
  avatarId: string
} | null> {
  try {
    const data = await invokePipelineTool<{
      type: string
      jobId: string
      status: string
      avatarId: string
      message?: string
    }>("generate_video", {
      audioUrl,
      audioPath: audioPath ?? audioUrl,
      avatarId: avatarId ?? "default",
    })

    return {
      jobId: data.jobId,
      status: data.status,
      avatarId: data.avatarId,
      message: data.message,
    }
  } catch {
    return null
  }
}

export async function* subscribeToJob(jobId: string) {
  const eventSource = new EventSource(`/api/jobs/${jobId}/events`);

  const messageQueue: any[] = [];
  let resolve: ((value: any) => void) | null = null;

  eventSource.addEventListener('status', (event) => {
    const data = JSON.parse(event.data);
    if (resolve) {
      resolve(data);
      resolve = null;
    } else {
      messageQueue.push(data);
    }
  });

  eventSource.addEventListener('completed', (event) => {
    const data = JSON.parse(event.data);
    if (resolve) {
      resolve({ ...data, completed: true });
      resolve = null;
    } else {
      messageQueue.push({ ...data, completed: true });
    }
    eventSource.close();
  });

  eventSource.addEventListener('error', () => {
    eventSource.close();
  });

  while (true) {
    if (messageQueue.length > 0) {
      const message = messageQueue.shift();
      if (message.completed) {
        eventSource.close();
        yield message;
        break;
      }
      yield message;
    } else {
      const message = await new Promise<any>((r) => {
        resolve = r;
      });
      if (message.completed) {
        eventSource.close();
        yield message;
        break;
      }
      yield message;
    }
  }
}
