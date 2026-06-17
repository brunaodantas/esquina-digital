@AGENTS.md

# Esquina Digital Dashboard

Next.js dashboard at `digital-esquina.vercel.app`. Three pages: Entregas, Meta Ads, Google Ads.

## Menu de navegação (header em `dashboard/page.tsx`)

Ordem dos botões da esquerda para a direita: **Meta Ads · Google Ads · TikTok · Relatório WA · Boletim PDF · Entregas**. As três redes ficam contínuas no início; o Entregas fica por último (após o Boletim PDF), por ser um fluxo operacional, não de mídia. Todos os botões chamam `setActiveTab(...)` exceto Relatório WA e Boletim PDF (abrem modais).

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

### Seção Audiência — Meta Ads (`meta-ads/page.tsx`)
Componente `AudienciaSection` exibido após os account cards e antes da DataTable.
- Agrega `audiencia.genero`, `audiencia.idade`, `audiencia.dispositivos` de todas as contas filtradas
- Barras horizontais com percentual de impressões por categoria
- Os dados vêm de 3 chamadas adicionais por conta no `/api/meta-ads`: breakdowns `gender`, `age`, `device_platform`
- Renderiza apenas quando há dados; oculto automaticamente se a API não retornar breakdowns

### Seção Audiência — Google Ads (`google-ads/page.tsx`)
Componente `AudienciaSection` (mesmo layout da Meta) exibido após os account cards, antes de Cidades.
- Dados de 3 queries GAQL adicionais por conta em `/api/google-ads`: `gender_view` (gênero), `age_range_view` (idade), `segments.device` em `campaign` (dispositivos). Todas com `.catch(() => [])`.
- Labels traduzidos: MALE→Masculino, AGE_RANGE_25_34→25-34, MOBILE→Celular etc.

**Visualizações YouTube — `metrics.video_views` NÃO existe na API v24** (`UNRECOGNIZED_FIELD`, confirmado via probe). Isso fazia as views aparecerem zeradas no PDF. Pior: incluir `metrics.video_views` na query principal de campanhas derrubava TODAS as contas (a query não tem `.catch`). Fix: query isolada (com `.catch`) buscando `metrics.impressions` + `metrics.video_quartile_p25_rate` só de campanhas VIDEO; `videoViews = round(impressões × p25_rate)` = visualizações **estimadas** (quem assistiu ≥25%). PDF rotula "Estimadas (25%+)".

### Seção Cidades — Google Ads (`google-ads/page.tsx`)
Componente `CidadesSection` exibido após os account cards e antes da DataTable.
- Agrega cliques por cidade de todas as contas filtradas (top 10)
- Dados vêm de query `geographic_view` no GAQL + resolução de nomes via `geo_target_constant`
- Barra horizontal proporcional ao maior valor de cliques
- Oculto quando não há dados de cidade disponíveis

### Botão Relatório WA (dashboard/page.tsx)
Quarto botão no header do dashboard (cor verde, ícone ✉). Abre um modal com:
- **Cliente**: autocomplete obrigatório — carrega nomes das contas ativas de ambas as APIs ao abrir o modal; filtragem fuzzy por texto; seleção obrigatória para habilitar geração
- **Redes**: toggle Meta Ads / Google Ads (botões que ativam/desativam)
- **Período**: dropdown com presets (Este mês, Mês passado, Últimos 7/14/30 dias, Personalizado)
- **Incluir valores financeiros**: toggle que controla se Investimento, CPM, CPC e Custo/Conv. aparecem
- **Gerar Relatório**: busca `/api/meta-ads` e `/api/google-ads` em paralelo, **filtra pelo cliente selecionado** (`a.nome === clienteSelecionado`), monta mensagem formatada para WhatsApp
- **Copiar texto**: copia para o clipboard com feedback "✓ Copiado!"
- **Abrir no WhatsApp**: abre `https://wa.me/?text=...` (usuário escolhe o destinatário)

Frequência Meta Ads calculada como `impressões / alcance` (matematicamente correto ao agregar múltiplas contas).

**Regra crítica — filtro de cliente obrigatório:** O campo cliente não é mais texto livre. Sem seleção no autocomplete o botão "Gerar Relatório" fica desabilitado. O filtro usa `matchNome()` — normaliza nomes (minúsculas, sem acentos, sem pontuação) e verifica sobreposição de palavras significativas (>2 chars). Isso resolve o mismatch entre nomes do mesmo cliente em plataformas diferentes (ex: "PMC – Prefeitura de Campinas" no Meta vs "PMC - CAMPINAS" no Google Ads).

**Audiência no relatório WA:**
- Meta: Alcance, Frequência + breakdown de Gênero, Faixa etária e Dispositivos (% de impressões)
- Google: Exposição (impressões) + Top 5 cidades por cliques (quando disponível via `acc.cidades`)

## TikTok Ads

Página em `app/dashboard/tiktok-ads/page.tsx`, rota em `app/api/tiktok-ads/route.ts`.

**Advertiser IDs** hardcoded em `ADVERTISER_IDS` (8 contas). Nomes reais em `ADVERTISER_NAMES_FALLBACK` (preferir sempre o fallback, não o retorno da API, para garantir consistência entre dropdown e dados).

**Tabela com 3 níveis (Campanhas / Conjuntos de Anúncios / Anúncios)** — mesma estrutura do Meta. Componente `DataTable` em `tiktok-ads/page.tsx` com abas `NIVEL_TABS_TK`. A rota retorna `campanhas`, `grupos` (AUCTION_ADGROUP, dimensão `adgroup_id` + métricas `adgroup_name`/`campaign_name`) e `anuncios` (AUCTION_AD, dimensão `ad_id` + métricas `ad_name`/`adgroup_name`/`campaign_name`). Todos os `*_name` vêm como MÉTRICA (confirmado via probe — ver item 4). Colunas por nível: INVEST · IMPR · CLIQUES · CTR · CPM · CPC. Conjuntos mostram a campanha-mãe; Anúncios mostram conjunto + campanha.

> **Google Ads já tem a mesma estrutura de 3 abas** (componente `DataTable` em `google-ads/page.tsx`, `multiNivel`): Campanhas · Grupos de Anúncios · Anúncios. A rota retorna `campanhas`/`grupos`/`anuncios`. Nenhuma mudança necessária — já estava no padrão Meta.

**Bugs corrigidos (junho/2026):**

1. **Campanhas vazias (campRes código 40002 silencioso):** `campaign_name` como métrica no relatório `AUCTION_CAMPAIGN` era rejeitada silenciosamente pela API TikTok (retornava HTTP 200 com `code: 40002` em vez de erro). A query retornava `data.list = null` → `campanhas = []`. Fix: remover `campaign_name` das métricas e buscar nomes separadamente via `/campaign/get/`.

2. **Dropdown mostrando IDs em vez de nomes:** variável `nomes` no `return` apontava para `undefined` após renomeação de variável. Fix: `allNomesStatic` calculado antes da checagem de cache e usado em ambos os paths (cache hit e fresh fetch).

3. **Dropdown incompleto / nome errado na conta ANFAVEA:** `ADVERTISER_NAMES_FALLBACK['7646886376989982741']` estava mapeado como `'Conta TK'` em vez de `'ANFAVEA'`. Corrigido. Também: nomes do fallback nunca devem ser sobrescritos pelo retorno da API `/advertiser/info/` pois a API retorna nomes internos ("BIODIESEL_ESQUINA") que não batem com o dropdown — use `ADVERTISER_NAMES_FALLBACK[id] ?? nomeMap.get(id)` na ordem certa.

4. **Nomes de campanha exibidos como IDs (RESOLVIDO em v9 — confirmado via probe na API):** `campaign_name` deve ser pedido como **MÉTRICA** (com dimensão `['campaign_id']`), não como dimensão. Verdade confirmada testando a API direto:
   - `campaign_name` em `metrics` → **funciona** (retorna o nome em `metrics.campaign_name`)
   - `campaign_name` em `dimensions` → `code 40002` "campaign_name is not supported"
   - `AUCTION_AD` com dimensão `campaign_id` → `40002` "data_level AUCTION_AD and dimension campaign_id do not match" (a tentativa v8 estava fundamentalmente quebrada e ainda adicionava carga)

5. **Audiência idade e dispositivo (RESOLVIDO em v9):** dimensões corretas confirmadas via probe:
   - `gender` → MALE/FEMALE/NONE · `age` → AGE_18_24…AGE_55_100/NONE (precisa de label map) · `platform` → ANDROID/IPHONE/IPAD/WAP (dispositivo)
   - `platform_type`, `device_model`, `device_brand`, `os_platform` → todos `40002` não suportados (o código antigo usava `platform_type`, por isso dispositivo vinha vazio)

6. **Contas desaparecendo mesmo veiculando (RESOLVIDO em v9 — era RATE LIMITING):** a causa real era throttle de QPS. A rota disparava 6 chamadas × 8 contas = 48 requisições simultâneas; o TikTok limita QPS e devolvia vazio para chamadas throttled, derrubando contas aleatoriamente. Fix: (a) `mapLimit(ids, 3, …)` limita a 3 contas simultâneas (~18 chamadas de pico); (b) `tiktokGet` faz retry com backoff em HTTP 429/5xx e em códigos de throttle no corpo (40100/40016/50002/51000). Mantido o Fallback 2 (reconstruir totais da série diária).

**Cache versionado:** `CACHE_V = 'v10'`. Incrementar ao fazer deploy com mudança estrutural na rota para evitar instâncias Vercel warm servindo cache antigo. (v10 adicionou níveis grupos/anuncios; concorrência baixada para 2 contas porque agora são 8 chamadas/conta.)

**Como debugar a API TikTok:** `/api/*` não passa pelo middleware de auth (só `/dashboard/*`), então dá para `curl` a rota em produção. Para inspecionar respostas cruas da API, adicionar temporariamente um bloco `if (searchParams.get('debug'))` que roda chamadas sequenciais e retorna `{code, message, list}`. O token é "Sensitive" na Vercel (não sai no `vercel env pull`), então não dá para testar localmente — só via produção.

## matchNome — filtragem fuzzy de clientes

`matchNome(accNome, query)` é uma função de nível de módulo em `dashboard/page.tsx` (antes de `buildRelatorioHTML`). Normaliza ambos os nomes (lowercase, sem acentos, sem pontuação), extrai palavras com mais de 2 chars e verifica sobreposição.

**Regra obrigatória**: qualquer filtro de nome de conta por `clienteSelecionado` deve usar `matchNome()`, nunca `===`. Contas do mesmo cliente têm nomes diferentes por plataforma (ex: "PMC – Prefeitura de Campinas" no Meta vs "PMC-CAMPINAS" no Google Ads vs "PMC Campinas" no TikTok).

### Audiência TikTok no WA e PDF

**Relatório WA**: agrega `audiencia.genero`, `audiencia.idade`, `audiencia.plataforma` de `tiktokDados` em `tkAudGenMap`/`tkAudIdadeMap`/`tkAudPlatMap`, formata com `fmtBreakdown` e exibe seção `👥 Audiência TikTok` após as métricas de desempenho. Renderiza apenas quando a API TikTok retorna dados demográficos.

**Google Display / YouTube sem dados**: `analysisDisplay()` e `analysisYoutube()` verificam `dispImpr === 0` / `ytImpr === 0` e retornam mensagem "Sem dados para o período ou cliente selecionado" em vez de mostrar zeros. Causas comuns: período sem campanhas ativas, ou nome da conta Google Ads não coincide com o cliente via `matchNome`.

**Diagnóstico multiplataforma**: 2 novos blocos qualitativos após os existentes —
1. Distribuição % de impressões entre plataformas ativas (Meta / Google / TikTok)
2. Papel do TikTok como complemento ao Meta (% das impressões combinadas + contexto mobile-first)
Ambos renderizam apenas quando as plataformas relevantes têm dados.

### Audiência TikTok no PDF (buildRelatorioHTML)

`buildRelatorioHTML` recebe `tiktokDados: any[]` (array de contas filtradas, não só escalares). A função agrega `audiencia.genero`, `audiencia.idade`, `audiencia.plataforma` e exibe barras via `tiktokAudHtml('#00994D')` na seção TikTok — mesmo padrão da Meta. O KPI card 4 mostra CPM quando disponível.

### Diagnóstico qualitativo (buildRelatorioHTML)

Cada bullet do Diagnóstico cruza o dado numérico com uma interpretação contextual:
- CTR Display: compara com benchmark de 0,4% para programático
- YouTube VTR: compara com 25% como referência para in-stream
- Meta frequência: < 1,5x = baixa; 1,5–2,5x = adequada; > 2,5x = avaliar rotação
- TikTok CTR: < 0,3% = revisar criativos; 0,3–1,0% = dentro da faixa; > 1,0% = acima da média

## Correções de bug conhecidas

### Exportação CSV abre nova aba (corrigido)
O padrão `document.createElement('a'); a.click()` sem anexar ao DOM causa abertura de nova aba em Safari e Firefox.
**Padrão correto** — sempre usar em qualquer exportação de arquivo:
```ts
document.body.appendChild(a)
a.click()
document.body.removeChild(a)
setTimeout(() => URL.revokeObjectURL(url), 100)
```
Aplicado em `meta-ads/page.tsx` e `google-ads/page.tsx`.

## Botão Boletim PDF (dashboard/page.tsx)

Quinto botão no header (cor azul, ícone 📄). Abre `RelatorioSemanalModal` que gera um relatório semanal em slides HTML com `window.print()` automático.

**Arquitetura:**
- 100% client-side, zero custo: sem API routes, sem serverless, sem Playwright no servidor
- Modal: cliente (autocomplete igual ao WA), período (date pickers), seções (checkboxes), dados manuais (seguidores, visitas ao perfil — campos de TikTok removidos pois os dados vêm da API)
- `gerar()`: fetches `/api/meta-ads`, `/api/google-ads`, `/api/tiktok-ads`, Chart.js CDN, `/logo-esquina.png` em paralelo → `buildRelatorioHTML()` → `window.open()` → `window.print()` após 1,5s
- `buildRelatorioHTML()`: gera HTML completo autocontido com Chart.js inline, logo base64, CSS `@media print A4 landscape`

**Separação de campanhas:**
- Google Display: `tipoRaw === 'DISPLAY'`
- YouTube: `tipoRaw === 'VIDEO'`; conversões = inscritos
- Meta TD: campanhas cujo nome NÃO contém `/\bvp\b|visita|perfil/i`
- Meta VP: campanhas cujo nome contém esse padrão (se não existirem, toda a Meta cai em TD)

**Logo:** `public/logo-esquina.png` (copiada de `templates/assets/logo-esquina.png`)

**beforeprint handler:** redimensiona canvases com alturas por número de barras: 5+=200px, 4=175px, ≤3=160px, donut=220px

**Seções geradas (cada uma = 1 página A4 paisagem):**
Hero → Google Display → YouTube → Meta TD → Meta VP → TikTok → Diagnóstico → Conclusão → Footer

## Deploy
Push para `main` no GitHub dispara deploy automático na Vercel (conta `bruno@esquina.online`).

