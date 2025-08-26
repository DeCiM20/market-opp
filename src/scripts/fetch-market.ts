import axios from "axios"
import Bottleneck from "bottleneck"
import { db } from "~/utils/db"
import { env } from "~/utils/env"

const COINGECKO_API = "https://api.coingecko.com/api/v3"
const PROCESS_INTERVAL = 2 * 60 * 60 * 1000 // 2 HOURS
const headers = { "x-cg-demo-api-key": env.COINGECKO_API_KEY }

// ⚡ Bottleneck limiter: ~1 req/sec, up to 5 queued concurrently
// Adjust minTime depending on your API tier (default free tier ~50 req/min)
const limiter = new Bottleneck({
  minTime: 2000, // at least 2s between requests
  maxConcurrent: 1, // allow up to 1 promises in flight
})

async function limitedFetch<T>(url: string) {
  return limiter.schedule(() => axios.get<T>(url, { headers }))
}

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
  const { data } = await limitedFetch<Coin[]>(url)
  return data.map(coin => ({
    id: coin.id,
    symbol: coin.symbol,
    marketCap: coin.market_cap,
    currentVolume: coin.total_volume,
  }))
}

async function getToken30DayData(tokenId: string) {
  const url = `${COINGECKO_API}/coins/${tokenId}/market_chart?vs_currency=usd&days=30&interval=daily`
  const { data } = await limitedFetch<MarketChart>(url)

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

async function main() {
  for (let page = 1; page <= 20; page++) {
    const tokens = await getTopTokens(page)

    let results: any[] = []

    // Fetch tokens in sequence (safe), each request rate-limited by Bottleneck
    for (const token of tokens) {
      console.log(`Checking ${token.id}...`)
      try {
        const { prices, volumes } = await getToken30DayData(token.id)

        const dates = Object.keys(prices).sort()
        if (dates.length < 15) continue

        const lastDate = dates[dates.length - 1]
        const twoWeeksAgoDate = dates[dates.length - 15]

        const avgVolume14d = dates.slice(-15, -1).map(d => volumes[d]).reduce((a, b) => a + b, 0) / 14

        let surgeDay: string | null = null
        let surgeMultiplier = 0
        for (let i = dates.length - 2; i < dates.length; i++) {
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
            url: `https://www.coingecko.com/en/coins/${token.id}`,
            marketCap: token.marketCap.toLocaleString(),
            avgVolume: Math.round(avgVolume14d),
            surgeDay: surgeDay,
            surgeVolume: volumes[surgeDay],
            surgeMultiplier: surgeMultiplier.toFixed(2) + "x",
            priceStart: price2wAgo,
            priceSurge: priceSurgeDay,
            priceToday: priceNow,
            priceChange: priceChange.toFixed(2) + "%",
          })
        }
      } catch (err) {
        console.error(`❌ Failed to fetch market data for ${token.id}: ${err}`)
      }
    }

    if (results.length === 0) continue

    await db.$transaction(
      results.map(token =>
        db.token.upsert({
          where: { id: token.id },
          update: token,
          create: token,
        })
      )
    )
  }
}

async function schedulerLoop() {
  try {
    await main()
    await db.lastUpdate.upsert({ where: { id: 1 }, update: { timestamp: new Date() }, create: { id: 1, timestamp: new Date() } })
  } catch (err) {
    console.error("Scheduler error:", err)
  } finally {
    setTimeout(schedulerLoop, PROCESS_INTERVAL)
  }
}

// Start loop immediately
setImmediate(() => schedulerLoop())
