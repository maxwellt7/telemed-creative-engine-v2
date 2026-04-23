import { createTRPCClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../../worker/src/router'

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${process.env.RAILWAY_BACKEND_URL ?? 'http://localhost:3001'}/trpc`,
    }),
  ],
})
