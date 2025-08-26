import { createClient } from "redis"

const redisClient = createClient({ url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379" })
redisClient.connect().then(() => console.log("Redis connected")).catch(e => console.log("Error connecting redis", e))

export default redisClient