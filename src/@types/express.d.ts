export {} // this makes the file a module

export type SessionOrgType = {
  id: string
}

declare global {
  namespace Express {
    interface Request {}
  }
}
