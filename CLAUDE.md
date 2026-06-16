@AGENTS.md

# Esquina Digital Dashboard

Next.js dashboard at `digital-esquina.vercel.app`. Three pages: Entregas, Meta Ads, Google Ads.

## Estrutura de páginas

| Página | Arquivo | Fonte de dados |
|---|---|---|
| Entregas | `app/dashboard/entregas/page.tsx` | Google Sheets via `/api/entregas` |
| Meta Ads | `app/dashboard/meta-ads/page.tsx` | Meta Graph API via `/api/meta-ads` |
| Google Ads | `app/dashboard/google-ads/page.tsx` | Google Ads API via `/api/google-ads` |

## Componentes compartilhados

- **`CopiavelNum`** — número compacto com tooltip hover + click-to-copy (`cursor: copy`, feedback "✓ Copiado!")
- **`NumWithTooltip`** (Entregas) — versão com copy usada nos cards de campanha
- **`KpiTile`** — tile de KPI aceita prop `delta?: number | null` para mostrar variação % vs período anterior
- **`deliveryColor(pct, bateu, status)`** — retorna cor (verde/amarelo/laranja/vermelho/cinza) conforme progresso da entrega

## Funcionalidades implementadas

### Entregas
- Cards de campanha mostram apenas o status badge e pill de período (canalTag removida — task 2)
- Entregue label + valor coloridos via `deliveryColor` (task 3)
- Nomes de entrega sem colchetes `[CPM]`, `[CPC]` etc. (task 1)
- `NumWithTooltip` com click-to-copy (task 4)

### Meta Ads e Google Ads
- Nomes de campanha exibidos sem colchetes `.replace(/\[.*?\]/g, '').trim()` (task 1)
- Headers de métricas clicáveis ordenam asc/desc (`sortCol`, `sortDir`, `toggleSort`) (task 5)
- Botão "↓ CSV" exporta dados filtrados/ordenados com BOM UTF-8 para Excel (task 6)
- Botão "⇄ Comparar" busca período anterior de mesma duração e exibe `delta %` nos KpiTiles (task 7)

### Período de comparação
- `getPrevPeriodo(p)`: prevEnd = currentStart - 1 dia; prevStart = prevEnd - duração em dias
- `pDelta(curr, prev)`: retorna `null` quando não está comparando ou prev = 0

## Auto-refresh
Google Ads e Entregas atualizam automaticamente no próximo horário par (1h, 3h, 5h… BRT).
Cache da API: 30 min para Google Ads e Meta Ads; 1800s para Entregas (Sheets).

## Deploy
Push para `main` no GitHub dispara deploy automático na Vercel (conta `bruno@esquina.online`).

