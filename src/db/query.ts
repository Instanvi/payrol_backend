export async function findOne<T>(rows: Promise<T[]>): Promise<T | undefined> {
  const result = await rows
  return result[0]
}
