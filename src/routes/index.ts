import express, { Request, Response } from "express"
import controller from "./controller"

const router = express.Router()

router.get("/tokens", controller.data)
router.get("/download-excel", controller.excel)

router.get("/ping", (_req: Request, res: Response) => res.status(200).json({ success: true }))

export default router
