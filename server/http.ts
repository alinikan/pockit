export type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

export type ApiResponse = {
  status(code: number): ApiResponse
  json(value: unknown): void
  setHeader(name: string, value: string): void
}

export function json(response: ApiResponse, code: number, value: unknown) {
  response.setHeader('Cache-Control', 'no-store')
  response.status(code).json(value)
}

export function header(request: ApiRequest, name: string): string {
  const value = request.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export function bearerToken(request: ApiRequest): string | null {
  const match = /^Bearer ([^\s]+)$/.exec(header(request, 'authorization'))
  return match?.[1] || null
}

export function sameSecret(received: string, expected: string): boolean {
  if (!received || !expected || received.length !== expected.length) return false
  let difference = 0
  for (let index = 0; index < expected.length; index++)
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index)
  return difference === 0
}

export function requiredEnv(name: string): string {
  const env = (
    globalThis as typeof globalThis & {
      process: { env: Record<string, string | undefined> }
    }
  ).process.env
  const value = env[name]
  if (!value) throw new Error(`Missing server environment variable: ${name}`)
  return value
}
