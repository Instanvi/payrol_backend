import { z } from "zod"

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional().default(""),
  sortBy: z.string().optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  status: z.string().optional(),
  role: z.string().optional(),
  payRunId: z.string().optional(),
  level: z.string().optional(),
  mobileAccountStatus: z.enum(["valid", "invalid", "unchecked"]).optional(),
  carrier: z.string().optional(),
})

export type ListQuery = z.infer<typeof listQuerySchema>

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function paginateList<T>(
  items: T[],
  query: ListQuery,
  options?: {
    searchKeys?: (keyof T)[]
    filter?: (item: T, query: ListQuery) => boolean
  }
) {
  const search = (query.search ?? "").trim().toLowerCase()
  let filtered = [...items]

  if (search && options?.searchKeys?.length) {
    filtered = filtered.filter((item) =>
      options.searchKeys!.some((key) => {
        const value = item[key]
        return (
          typeof value === "string" && value.toLowerCase().includes(search)
        )
      })
    )
  }

  if (options?.filter) {
    filtered = filtered.filter((item) => options.filter!(item, query))
  }

  const sortBy = query.sortBy ?? "createdAt"
  const sortOrder = query.sortOrder ?? "desc"

  filtered.sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[sortBy]
    const bVal = (b as Record<string, unknown>)[sortBy]

    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1

    let cmp = 0
    if (typeof aVal === "number" && typeof bVal === "number") {
      cmp = aVal - bVal
    } else {
      cmp = String(aVal).localeCompare(String(bVal))
    }

    return sortOrder === "asc" ? cmp : -cmp
  })

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
  const page = Math.min(query.page, totalPages)
  const start = (page - 1) * query.pageSize
  const data = filtered.slice(start, start + query.pageSize)

  const meta: PaginationMeta = {
    page,
    pageSize: query.pageSize,
    total,
    totalPages,
  }

  return { data, meta }
}
