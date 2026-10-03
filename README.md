# Painel Operacional WMS

Dashboard operacional para consulta de ordens, expedição, estoque, indicadores e monitoramento via API E-SHIP.

Aplicação publicada em: https://painelwms.vercel.app

## Development  

Requires Node.js and npm.

```sh
npm install --no-package-lock
npm run dev
```

Configure `ESHIP_API_KEY` as a server-side environment variable. For local development, add it to an ignored `.env.local` file. On Vercel, add it under **Project Settings → Environment Variables** for the required environments, then redeploy. The key is never stored in browser storage or sent by the client.
