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

### Seção Audiência — Meta Ads (`meta-ads/page.tsx`)
Componente `AudienciaSection` exibido após os account cards e antes da DataTable.
- Agrega `audiencia.genero`, `audiencia.idade`, `audiencia.dispositivos` de todas as contas filtradas
- Barras horizontais com percentual de impressões por categoria
- Os dados vêm de 3 chamadas adicionais por conta no `/api/meta-ads`: breakdowns `gender`, `age`, `device_platform`
- Renderiza apenas quando há dados; oculto automaticamente se a API não retornar breakdowns

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

