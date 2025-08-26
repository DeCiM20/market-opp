import { Queue } from "bullmq"
import { env } from "~/utils/env"

export const queueOptions = {
  removeOnComplete: { age: 3600 }, // 1 hour
  removeOnFail: { age: 3600 }, // 1 hour
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
}

export const workerOptions = { connection: { url: env.REDIS_URL }, concurrency: 5 }

const deploy = new Queue("process-fetch-market", { connection: { url: env.REDIS_URL } })

export default { deploy }
