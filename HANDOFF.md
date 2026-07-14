# Handoff — Dashboard Esquina Digital

Documento pra passar o projeto do dashboard pra outra sessão do Claude.

## O que é
Dashboard de performance de mídia da Esquina, ao vivo em **https://digital-esquina.vercel.app/dashboard**.
Next.js (App Router) + React + TypeScript. Login por Firebase Auth.
Mostra Meta Ads, Google Ads, TikTok Ads e a aba Entregas (metas vs entregue, via Google Sheets).

## Onde está o projeto (a pasta)
```
/Users/bruno/esquina-digital
```
- Repositório: `https://github.com/brunaodantas/esquina-digital` (branch `main`)
- Deploy: **Vercel** — publica automaticamente a cada `git push` na `main`. Conta Vercel/GitHub: **bruno@esquina.online** (nunca usar o gmail pessoal).

## Estrutura principal
- **APIs (backend):** `app/api/{meta-ads,google-ads,tiktok-ads,entregas,snapshot}/route.ts`
- **Páginas (frontend):** `app/dashboard/page.tsx` (shell + navegação) e `app/dashboard/{meta-ads,google-ads,tiktok-ads,entregas}/page.tsx`
- **Cache:** `lib/cache.ts` (Supabase, TTL 1h; `?fresh=1` fura o cache). `lib/supabase.ts`.

## Como rodar / publicar
- Verificar tipos: `npx tsc --noEmit`
- Build local: `npm run build`
- Publicar: `git add -A && git commit && git push origin main` (o Vercel faz o deploy sozinho).
- **Sempre perguntar ao Bruno antes de commit/push/deploy.**
- Tokens e chaves (Meta, Google Ads, TikTok, Supabase) ficam só nas variáveis de ambiente do Vercel — não estão no código nem no `.env.local` (que só tem Firebase + Resend).

## Estado atual (jul/2026)
- Coluna **GASTO** (valor gasto) em primeiro, ao lado de **ORÇAMENTO**, no Meta e Google.
- Coluna **STATUS** dos anúncios com motivo no hover (Meta e Google funcionando; TikTok mostra "—" porque o token não tem escopo Ads Management).
- Filtros de campanha revisados; dropdown de conta só lista contas com dados no período.
- Datas usam horário local (não `toISOString`).

## Como testar sem quebrar
- Dá pra bater direto nas APIs em produção (sem auth): 
  `curl -s "https://digital-esquina.vercel.app/api/meta-ads?start=2026-06-01&end=2026-06-30&fresh=1"`
- As páginas `/dashboard/*` exigem login Firebase.
