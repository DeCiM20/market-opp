import { ZodSchema } from "zod"

export const zBodyParse = <T>(schema: ZodSchema<T>, body: any) => {
  const { success, error, data } = schema.safeParse(body)

  if (!success || error) {
    const zErrors: Record<string, string[] | undefined> = error?.flatten().fieldErrors
    
    let errors: Record<string, string> = {}

    Object.keys(zErrors).map(i => {
      const errorMessage = zErrors[i]?.[0]
      errors[i] = errorMessage ?? `Invalid input ${i}`
    })

    return { success, data: null, error: errors }
  }

  return { success: true, data: data, error: null }
}
