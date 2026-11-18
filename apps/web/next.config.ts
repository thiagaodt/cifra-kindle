import type { NextConfig } from "next";

/**
 * Alvo do proxy de `/api/*`. MVP 100% localhost (C-14): a API Express sempre
 * roda em `http://localhost:3333` fora do Docker, ou `http://api:3333` dentro
 * da rede do compose (ver docker-compose.dev.yml).
 */
const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:3333";

const nextConfig: NextConfig = {
  /**
   * A API é servida pela MESMA origem do front: sem CORS cross-origin e sem
   * autenticação/multi-tenant (NG-5) — `apps/web` fala com a API via proxy
   * same-origin.
   */
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiProxyTarget}/api/:path*` }];
  },
};

export default nextConfig;
