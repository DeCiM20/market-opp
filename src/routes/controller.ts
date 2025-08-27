import { Request, Response } from "express"
import { db } from "~/utils/db"
import { dateLocale } from "~/utils/utils"
import ExcelJS from "exceljs"
import { Token } from "@prisma/client"

const PAGES = 20

const data = async (_req: Request, res: Response) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [lu, tokens] = await db.$transaction([db.lastUpdate.findFirst({ where: { id: 1 } }), db.token.findMany({ where: { updatedAt: { gte: oneDayAgo, lte: new Date() }, createdAt: { gte: oneDayAgo, lte: new Date() } } })])

  return res.status(200).json({ lastUpdatedOn: lu ? dateLocale(lu.timestamp) : "No last update date!", range: `Top ${PAGES * 100} tokens are being parsed for market data`, limits: "Limit of 1 hour per refresh has been set.", tokens })
}

const excel = async (_req: Request, res: Response) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [lu, tokens] = await db.$transaction([db.lastUpdate.findFirst({ where: { id: 1 } }), db.token.findMany({ where: { updatedAt: { gte: oneDayAgo, lte: new Date() }, createdAt: { gte: oneDayAgo, lte: new Date() } } })])

  // 2. Create a new workbook
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet("Tokens")

  // 3. Define headers
  worksheet.columns = [
    { header: "ID", key: "id", width: 20 },
    { header: "Symbol", key: "symbol", width: 15 },
    { header: "URL", key: "url", width: 30 },
    { header: "Market Cap", key: "marketCap", width: 20 },
    { header: "Avg Volume", key: "avgVolume", width: 15 },
    { header: "Surge Day", key: "surgeDay", width: 20 },
    { header: "Surge Volume", key: "surgeVolume", width: 15 },
    { header: "Surge Multiplier", key: "surgeMultiplier", width: 20 },
    { header: "Price Start", key: "priceStart", width: 15 },
    { header: "Price Surge", key: "priceSurge", width: 15 },
    { header: "Price Today", key: "priceToday", width: 15 },
    { header: "Price Change", key: "priceChange", width: 15 },
    { header: "Created At", key: "createdAt", width: 25 },
    { header: "Updated At", key: "updatedAt", width: 25 },
  ]

  // 4. Add data rows
  tokens.forEach((token: Token) => {
    worksheet.addRow({
      ...token,
      createdAt: dateLocale(token.createdAt),
      updatedAt: dateLocale(token.updatedAt),
    })
  })

  // 5. Set response headers for file download
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  res.setHeader("Content-Disposition", `attachment; filename=tokens_${dateLocale(lu ? lu.timestamp : new Date())}.xlsx`)

  // 6. Write workbook to response
  await workbook.xlsx.write(res)
  return res.end()
}

export default { data, excel }
0
