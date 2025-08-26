import { Request, Response } from "express"
import { db } from "~/utils/db"
import { dateLocale } from "~/utils/utils"

const PAGES = 20

const data = async (_req: Request, res: Response) => {
  const tm = new Date(Date.now() - 60 * 60 * 1000) // 1 HR
  const lu = await db.lastUpdate.findFirst({ where: { timestamp: { gt: tm } } })

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const tokens = await db.token.findMany({ where: { updatedAt: { gte: oneDayAgo, lte: new Date() }, createdAt: { gte: oneDayAgo, lte: new Date() } } })

  return res.status(200).json({ lastUpdatedOn: lu ? dateLocale(lu.timestamp) : "No last update date!", range: `Top ${PAGES * 100} tokens are being parsed for market data`, limits: "Limit of 1 hour per refresh has been set.", tokens })
}

export default { data }
