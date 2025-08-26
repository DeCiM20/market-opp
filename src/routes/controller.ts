import { Request, Response } from "express"
import { ExpressError } from "~/middleware/error"
import { PayloadType } from "~/scripts/fetch-market"
import { db } from "~/utils/db"
import queue, { queueOptions } from "~/utils/queue"
import { dateLocale } from "~/utils/utils"

const PAGES = 20

const data = async (_req: Request, res: Response) => {
  const tm = new Date(Date.now() - 60 * 60 * 1000) // 1 HR
  const lu = await db.lastUpdate.findFirst({ where: { timestamp: { gt: tm } } })

  if (!lu) {
    const existing = await queue.deploy.getJobCountByTypes("active")
    if (existing !== 0) throw new ExpressError({ code: "CONFLICT", message: "Refresh already in progress!!" })

    for (let i = 1; i <= PAGES; i++) {
      const payload: PayloadType = { page: i }
      await queue.deploy.add("fetch-market", payload, { ...queueOptions, removeOnFail: true, attempts: 1, removeOnComplete: true })
    }
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const tokens = await db.token.findMany({ where: { updatedAt: { gte: oneDayAgo, lte: new Date() }, createdAt: { gte: oneDayAgo, lte: new Date() } } })

  return res.status(200).json({ lastUpdatedOn: lu ? dateLocale(lu.timestamp) : "No last update date!", range: `Top ${PAGES * 100} tokens are being parsed for market data`, limits: "Limit of 1 hour per refresh has been set.", tokens })
}

export default { data }
