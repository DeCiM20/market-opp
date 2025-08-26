import axios from "axios"
import { Worker, Job } from "bullmq"
import { db } from "~/utils/db"
import { env } from "~/utils/env"
import { workerOptions } from "~/utils/queue"

const COINGECKO_API = "https://api.coingecko.com/api/v3"
const headers = { "x-cg-demo-api-key": env.COINGECKO_API_KEY }

interface Coin {
  id: string
  symbol: string
  market_cap: number
  total_volume: number
}

interface MarketChart {
  prices: number[][]
  total_volumes: number[][]
}

function formatDate(ts: string | Date | number) {
  const d = new Date(ts)
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0")
}

async function getTopTokens(page: number) {
  const url = `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=${page}`
  const { data } = await axios.get<Coin[]>(url, { headers })
  return data.map(coin => ({
    id: coin.id,
    symbol: coin.symbol,
    marketCap: coin.market_cap,
    currentVolume: coin.total_volume,
  }))
}

async function getToken30DayData(tokenId: string) {
  const url = `${COINGECKO_API}/coins/${tokenId}/market_chart?vs_currency=usd&days=30&interval=daily`
  const { data } = await axios.get<MarketChart>(url, { headers })

  const prices: Record<string, number> = {}
  const volumes: Record<string, number> = {}

  data.prices.forEach(([ts, price]) => {
    prices[formatDate(ts)] = price
  })

  data.total_volumes.forEach(([ts, vol]) => {
    volumes[formatDate(ts)] = vol
  })

  return { prices, volumes }
}

export type PayloadType = { page: number }

async function processJob(job: Job) {
  const data = job.data as PayloadType
  const tokens = await getTopTokens(data.page)

  let results = []

  for (const token of tokens) {
    console.log(`Checking ${token.id}...`)
    try {
      const { prices, volumes } = await getToken30DayData(token.id)

      const dates = Object.keys(prices).sort()
      if (dates.length < 15) continue

      const lastDate = dates[dates.length - 1]
      const twoWeeksAgoDate = dates[dates.length - 15]

      const avgVolume14d = dates.slice(-15, -1).map(d => volumes[d]).reduce((a, b) => a + b, 0) / 14

      let surgeDay = null
      let surgeMultiplier = 0
      for (let i = dates.length - 2; i < dates.length; i++) {
        // last 2 days
        const d = dates[i]
        const v = volumes[d]
        if (v >= 1.5 * avgVolume14d) {
          surgeDay = d
          surgeMultiplier = v / avgVolume14d
          break
        }
      }

      if (!surgeDay) continue

      const priceSurgeDay = prices[surgeDay]
      const price2wAgo = prices[twoWeeksAgoDate]
      const priceNow = prices[lastDate]
      const priceChange = ((priceSurgeDay - price2wAgo) / price2wAgo) * 100

      if (priceChange >= 20) {
        results.push({
          id: token.id,
          symbol: token.symbol.toUpperCase(),
          marketCap: token.marketCap.toLocaleString(),
          avgVolume: Math.round(avgVolume14d),
          surgeDay: surgeDay,
          surgeVolume: volumes[surgeDay],
          surgeMultiplier: surgeMultiplier.toFixed(2) + "x",
          priceStart: price2wAgo,
          priceSurge: priceSurgeDay,
          priceToday: priceNow,
          priceChange: priceChange,
        })
      }

      await new Promise(res => setTimeout(res, 2000))
    } catch (err) {
      console.error(`❌ Failed to fetch market data for ${token.id}: ${err}`)
    }
  }

  if (results.length === 0) return

  await db.$transaction(
    results.map(token =>
      db.token.upsert({
        where: { id: token.id },
        update: token,
        create: token,
      })
    )
  )

  await db.lastUpdate.upsert({ where: { id: 1 }, update: { timestamp: new Date() }, create: { id: 1, timestamp: new Date() } })
}

// Create the worker
const worker = new Worker<PayloadType>("process-fetch-market", async job => await processJob(job), workerOptions)

worker.on("failed", async (job, err) => {
  if (!job) return console.log("Job not found!")
  console.error("Worker failed for job", job.id, err)
})

console.log("🚀 Worker listening on 'process-fetch-market'")
