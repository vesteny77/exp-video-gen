import { jobStore, type Job } from "@/lib/api/jobStore"

async function waitForJobCompletion(jobId: string) {
  return await new Promise<Job>((resolve, reject) => {
    const unsubscribe = jobStore.subscribe(jobId, (updatedJob) => {
      if (updatedJob.status === "completed") {
        unsubscribe()
        resolve(updatedJob)
      } else if (updatedJob.status === "failed") {
        unsubscribe()
        reject(
          new Error(
            updatedJob.error || `Job ${jobId} failed while processing ${updatedJob.type}`,
          ),
        )
      }
    })
  })
}

export async function runJobAndAwait<T extends Job["type"], TResult = any>(
  type: T,
  input: Job["input"],
): Promise<{ job: Job; result: TResult }> {
  const job = jobStore.createJob(type, input)
  const current = jobStore.getJob(job.id)
  const completedJob =
    current && current.status === "completed"
      ? current
      : await waitForJobCompletion(job.id)

  if (completedJob.status !== "completed" || !completedJob.result) {
    throw new Error(`Job ${completedJob.id} did not complete successfully`)
  }

  return {
    job: completedJob,
    result: completedJob.result as TResult,
  }
}
