import "express-async-errors"
import express, { Express, NextFunction, Request, Response } from "express"
import cookieParser from "cookie-parser"
import bodyParser from "body-parser"
import { env } from "./utils/env"

const app: Express = express()

import corsOptions from "./cors"
import { ERROR_CODES, ExpressError } from "./middleware/error"
import { rateLimit } from "express-rate-limit"
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 })

app.use(corsOptions)
app.use(cookieParser())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(limiter)

app.listen(env.PORT, () => console.log(`[server]: Server is running at port ${env.PORT}`))

import router from "./routes"

app.use("/api", router)

app.use((req: Request, _res: Response, next: NextFunction) => {
  const error = new ExpressError({ code: "NOT_FOUND", message: `Route ${req.originalUrl} not found.` })
  next(error)
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ExpressError) {
    const statusCode = ERROR_CODES[err.code] || 500
    return res.status(statusCode).json({ status: statusCode, message: err.message, error: err.error })
  } else {
    console.error("Internal Server Error", { message: err.message, stack: err.stack })
    return res.status(500).json({ status: 500, message: "Internal Server Error !!!" })
  }
})

import "~/scripts/fetch-market"
