import type { Request } from "express"

export function getRouteParam(req: Request, name: string): string {
  const value = req.params[name]
  const param = Array.isArray(value) ? value[0] : value
  if (!param) {
    throw new Error(`Missing route parameter: ${name}`)
  }
  return param
}
