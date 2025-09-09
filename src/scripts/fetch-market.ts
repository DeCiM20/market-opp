import axios from "axios"
import Bottleneck from "bottleneck"
import { db } from "~/utils/db"
import { env } from "~/utils/env"

const COINGECKO_API = "https://api.coingecko.com/api/v3"
const PROCESS_INTERVAL = 16 * 60 * 60 * 1000 // 16 HOURS

// ⚡ Bottleneck limiter: ~1 req/sec, up to 5 queued concurrently
// Adjust minTime depending on your API tier (default free tier ~50 req/min)
const limiter = new Bottleneck({
  reservoir: 1, // allow 1 request
  reservoirRefreshAmount: 1,
  reservoirRefreshInterval: 2500, // every 2.5s, refill
  maxConcurrent: 1,
})

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

class MarketData {
  constructor(private headers: Record<string, string>) {}

  private async limitedFetch<T>(url: string) {
    return limiter.schedule(() => axios.get<T>(url, { headers: this.headers }))
  }

  private formatDate(ts: string | Date | number) {
    const d = new Date(ts)
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0")
  }

  // Top token list
  private async list(page: number) {
    const url = `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=${page}`
    const { data } = await this.limitedFetch<Coin[]>(url)
    return data.map(coin => ({
      id: coin.id,
      symbol: coin.symbol,
      marketCap: coin.market_cap,
      currentVolume: coin.total_volume,
    }))
  }

  // Market history for token
  private async history(tokenId: string) {
    const url = `${COINGECKO_API}/coins/${tokenId}/market_chart?vs_currency=usd&days=30&interval=daily`
    const { data } = await this.limitedFetch<MarketChart>(url)

    const prices: Record<string, number> = {}
    const volumes: Record<string, number> = {}

    data.prices.forEach(([ts, price]) => {
      prices[this.formatDate(ts)] = price
    })

    data.total_volumes.forEach(([ts, vol]) => {
      volumes[this.formatDate(ts)] = vol
    })

    return { prices, volumes }
  }

  async run() {
    for (let page = 1; page <= 20; page++) {
      const tokens = await this.list(page)

      let results: any[] = []

      // Fetch tokens in sequence (safe), each request rate-limited by Bottleneck
      for (const token of tokens) {
        console.log(`Checking ${token.id}...`)
        try {
          const { prices, volumes } = await this.history(token.id)

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
      await db.$transaction(results.map(token => db.token.upsert({ where: { id: token.id }, update: token, create: token })))
    }
  }
}

async function schedulerLoop() {
  try {
    const lu = await db.lastUpdate.findUnique({ where: { id: 1 } })
    // Check if last update exists and get the next key (if key is 10, reset to 0)
    const ki = lu ? (lu.key === 11 ? 0 : lu.key + 1) : 0 // key index
    // Use the next api key based on the last update key
    const headers = { "x-cg-demo-api-key": env.COINGECKO_API_KEYS[ki] }
    const mdc = new MarketData(headers)
    await mdc.run()
    await db.lastUpdate.upsert({ where: { id: 1 }, update: { timestamp: new Date() }, create: { id: 1, timestamp: new Date(), key: ki } })
  } catch (err) {
    console.error("Scheduler error:", err)
  } finally {
    setTimeout(schedulerLoop, PROCESS_INTERVAL)
  }
}

// Start loop immediately
setImmediate(() => schedulerLoop())
