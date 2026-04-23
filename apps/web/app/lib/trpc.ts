import { createTRPCClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../../worker/src/router'

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'}/trpc`,
      headers() {
        return process.env.NEXT_PUBLIC_API_SECRET ? { 'x-api-secret': process.env.NEXT_PUBLIC_API_SECRET } : {}
      },
    }),
  ],
})
