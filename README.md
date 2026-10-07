# Painel de Acompanhamento

Painel informativo para exibição contínua em TV Samsung UN55AU7700G de 55", com área lógica fixa de 1920×1080.

> **Este README é o mapa operacional do projeto.**
>
> Sempre que um ZIP deste repositório for recebido, o procedimento obrigatório é: extrair o pacote, ler integralmente este README e somente depois inspecionar/alterar os arquivos vigentes da visão solicitada.
>
> O código atual do repositório prevalece sobre versões históricas presentes em conversas.

---

## 1. Fonte oficial e padrão vigente

O repositório GitHub `painel-acompanhamento` é a fonte oficial do código.

**Padrão vigente: PG-V2.**

O PG-V2 substitui a arquitetura PG-V1 baseada em páginas HTML completas + `iframe`.

### Princípio do PG-V2

O painel é uma aplicação de página única:

```text
index.html (shell único)
    ↓
fragmento da visão
    + CSS específico
    + módulo JS específico
    + fonte de dados
    ↓
próxima visão
    ↓
...
    ↓
fim do ciclo principal
    ↓
reload completo do index.html
```

Não utilizar `iframe` para a circulação das visões do PG-V2.

---

## 2. Identificadores canônicos

| ID | Nome | Situação | Fragmento |
|---|---|---|---|
| **PG-V2** | Padrão Geral | Vigente | `index.html`, `css/painel-base.css`, `js/painel-base.js`, `js/painel-config.js`, `js/painel-player.js` |
| **DC-V1** | Dia C | Em produção | `visoes/dia-c.html` |
| **ME_EXEC-V1** | Metas da Executiva | Em produção | `visoes/metas-executiva.html` |
| **ME_GER-V1** | Metas da Gerência | Em produção | `visoes/metas-gerencia.html` |
| **COM-V1** | Comissionamento de Obras | Em produção | `visoes/comissionamento.html` |
| **CAL-TV** | Calibração tipográfica para TV | Técnica / fora da rotação | `visoes/calibracao-tv.html` |
| **OA-V1** | Obras Ágeis | Convenção reservada | Pode não existir ainda |
| **IND-V1** | Indicadores | Convenção reservada | Pode não existir ainda |
| **PROD-V1** | Produtividade | Convenção reservada | Pode não existir ainda |

### Alias histórico

`META-V1` é nomenclatura antiga da atual **ME_EXEC-V1**. Não criar uma visão separada com esse nome.

---

## 3. Estrutura vigente

```text
painel-acompanhamento/
├── index.html
├── README.md
│
├── visoes/
│   ├── dia-c.html
│   ├── metas-executiva.html
│   ├── metas-gerencia.html
│   ├── comissionamento.html
│   └── calibracao-tv.html
│
├── css/
│   ├── painel-base.css
│   ├── dia-c.css
│   ├── metas-executiva.css
│   ├── metas-gerencia.css
│   ├── comissionamento.css
│   └── calibracao-tv.css
│
├── js/
│   ├── painel-config.js
│   ├── painel-base.js
│   ├── painel-player.js
│   ├── chart.umd.min.js
│   ├── chartjs-plugin-datalabels.min.js
│   ├── dia-c.js
│   ├── metas-executiva.js
│   ├── metas-gerencia.js
│   ├── comissionamento.js
│   └── calibracao-tv.js
│
├── dados/
│   ├── metas-executiva.json
│   ├── metas-gerencia.json
│   └── base_comissionamento.json
│
├── dados.json
│
└── img/
    └── logo-equatorial.svg
```

### Localização canônica do CSS base

Existe somente um CSS base:

```text
css/painel-base.css
```

Não criar `painel-base.css` na raiz ou dentro de `js/`.

---

## 4. Responsabilidades no PG-V2

### `index.html`

Shell único da aplicação. Contém:

- `#stage` 1920×1080;
- cabeçalho global;
- `#conteudoVisao`, onde os fragmentos são injetados;
- bibliotecas compartilhadas;
- carregamento do player central.

O `index.html` não contém a estrutura específica de DC-V1 ou ME_EXEC-V1.


### Shell global: cabeçalho, fundo e identidade visual

O elemento **G6** (área de rotação no topo direito) exibe somente o **contador regressivo em segundos** e a **barra de tempo em escoamento**. O nome da próxima visão/Subvisão não deve ser exibido nesse elemento.

No PG-V2, o shell pertence exclusivamente aos arquivos compartilhados. Isso inclui `#stage`, fundo global, cabeçalho, logo, separador, bloco de título, indicador da visão atual, área de próxima visão/barra de tempo, escala 1920×1080 e transições estruturais.

A estrutura fica no `index.html` e sua aparência fica em `css/painel-base.css`. O `index.html` mantém `width="215"` no logo como fallback de primeira renderização.

**CSS específico de visão não deve selecionar nem sobrescrever elementos do shell**, incluindo `#stage`, `.topo`, `.topo-identidade`, `.logo-equatorial`, `.separador-marca`, `.titulo-principal`, `.subtitulo-principal`, `.visao-indicador`, `.topo-rotacao`, `.proxima-visao`, `.barra-tempo` e `.barra-tempo-preenchimento`.

A visão pode fornecer os **conteúdos** do cabeçalho por meio da API compartilhada (`PAINEL_BASE.definirCabecalho`), mas não deve redefinir sua geometria ou identidade visual.

### `visoes/*.html`

São **fragmentos HTML**, não páginas completas.

Não devem conter:

```text
<!DOCTYPE html>
<html>
<head>
<body>
<script>
```

Devem conter somente o markup necessário para a área específica da visão. Atualmente os fragmentos começam em `<main class="pagina">`.

### `css/painel-base.css`

PG-V2 global e fonte única do shell:

- 1920×1080 e escala;
- `#stage` e fundo global;
- cabeçalho completo e identidade visual;
- logo, título, contexto, próxima visão e barra de tempo;
- superfícies/tipografia compartilhadas;
- transição do slot de fragmentos.

### `css/<visao>.css`

Somente aparência do **corpo do respectivo módulo**, dentro do fragmento injetado em `#conteudoVisao`.

Cada fragmento deve possuir uma classe raiz própria (por exemplo, `.visao-dia-c` ou `.visao-me-exec`) para permitir escopo claro de variáveis e regras específicas. O CSS de visão não pode estilizar o shell global.

### `js/painel-config.js`

Registro central das visões:

- ID;
- estado `ativo`;
- título/subtítulo;
- fragmento;
- CSS;
- módulo JS;
- parâmetros globais do player.

A propriedade `ativo` controla a participação da visão no ciclo principal:

```js
ativo: true   // visão apresentada normalmente
ativo: false  // visão ignorada pelo player
```

Por compatibilidade, se `ativo` não estiver informado, a visão é considerada ativa. O player trabalha apenas com registros onde `ativo !== false`, portanto uma visão desabilitada não consome tempo nem deixa intervalo vazio no ciclo.

### `js/painel-base.js`

Utilidades compartilhadas:

- escala do `#stage`;
- atualização do cabeçalho;
- helpers genéricos.

### `js/painel-player.js`

Controlador da sequência principal.

Os caminhos registrados em `PAINEL_CONFIG.visoes` são relativos ao `index.html`/raiz da aplicação. O player os resolve explicitamente contra `document.baseURI` antes de carregar fragmentos, CSS ou módulos ES. Isso evita que `import()` interprete `./js/...` relativamente ao próprio arquivo `js/painel-player.js` e produza caminhos incorretos como `js/js/...`.

Antes de iniciar o ciclo, o player filtra `PAINEL_CONFIG.visoes` e mantém somente as visões com `ativo !== false`.

Para cada visão ativa:

1. encerra o módulo anterior;
2. carrega o CSS específico;
3. busca/injeta o fragmento;
4. importa o módulo JS;
5. chama `await modulo.iniciar()`;
6. aguarda a visão concluir seu próprio ciclo;
7. chama `modulo.destruir()`;
8. avança para a próxima visão ativa.

Após a última visão, recarrega o `index.html` com um token `_ciclo=<timestamp>`.

### `js/<visao>.js`

Cada módulo deve exportar:

```js
export async function iniciar(contexto) { ... }
export function destruir() { ... }
```

`iniciar()` deve retornar/representar o ciclo completo daquela visão.

Para navegação manual em desenvolvimento, os módulos atuais também expõem as funções opcionais:

```js
export function avancarSubvisao() { ... }
export function voltarSubvisao() { ... }
export function alternarPausa() { ... }
```

A quantidade de Subvisões é responsabilidade do módulo, nunca do player.

---

## 5. Loop principal do PG-V2

```text
INDEX inicia
    ↓
DC-V1.iniciar()
    ↓
DC-V1 percorre Geral + Parceiras
    ↓
DC-V1 termina
    ↓
ME_EXEC-V1.iniciar()
    ↓
ME_EXEC-V1 percorre Geral + Categorias detalhadas
    ↓
ME_EXEC-V1 termina
    ↓
próximas visões...
    ↓
última visão termina
    ↓
INDEX faz reload completo
    ↓
novo ciclo
```

O player **não calcula a duração normal** de visões com Subvisões.

Cada módulo controla seu próprio tempo interno.

### Timeout de segurança

O player possui um limite máximo de segurança por visão (configurado em `painel-config.js`). Esse tempo não é a duração normal da visão; serve apenas para impedir que um erro deixe a TV presa indefinidamente.

---

## 5.1. Navegação manual de desenvolvimento

O PG-V2 possui atalhos de teclado exclusivamente para inspeção rápida durante o desenvolvimento. Eles ficam ativos somente quando o painel é aberto com o parâmetro:

```text
?dev=1
```

Exemplo:

```text
https://<host>/painel-acompanhamento/?dev=1
```

Atalhos disponíveis:

```text
→       avança imediatamente para a próxima Subvisão
←       retorna para a Subvisão anterior da visão atual
Espaço  pausa ou retoma a contagem regressiva automática
```

Regras:

- sem `?dev=1`, os atalhos ficam totalmente desabilitados e o comportamento normal da TV permanece inalterado;
- `→` na última Subvisão conclui a visão atual, permitindo que o player siga para a próxima visão principal ativa;
- `←` na primeira Subvisão não volta para a visão principal anterior; permanece na primeira Subvisão da visão atual;
- a pausa congela a contagem e a barra de tempo no ponto atual; ao retomar, a contagem continua do mesmo ponto;
- não existe indicador visual de modo DEV no shell.

---

## 5.2. Modo técnico de calibração da TV

A visão **CAL-TV** é a referência técnica da escala tipográfica calibrada do painel na TV real. Ela permanece registrada com `ativo: false` e **não participa da rotação normal**.

Para abri-la isoladamente, usar:

```text
?cal=1
```

Exemplo:

```text
https://<host>/painel-acompanhamento/?cal=1
```

Quando `?cal=1` está presente, o player seleciona exclusivamente a visão `CAL-TV`, mesmo com `ativo: false`, e suspende o timeout de segurança dessa visão para que a tela permaneça disponível durante toda a inspeção. Esse comportamento é exclusivo do modo de calibração; sem o parâmetro, o ciclo normal continua usando apenas as visões ativas.

A calibração presencial realizada na Samsung de 55" definiu como referências do PG-V2:

- **22 px** como menor tamanho confortável para informação HTML essencial;
- **22 px** como menor tamanho confortável para rótulos, eixos e legendas de Chart.js;
- **700** como peso preferido para informação relevante;
- o contraste de `--texto-secundario` como aceitável;
- **48 px** como KPI padrão;
- **52 px** como limite recomendado para KPI de destaque;
- **60 px** deve ser evitado por ter sido considerado excessivo no teste físico.

A CAL-TV deixa de ser apenas uma tela de experimento e passa a funcionar como **referência visual calibrada**. Os tokens globais correspondentes foram registrados no PG-V2, porém as visões produtivas existentes serão adequadas progressivamente; a criação dos tokens, por si só, não deve alterar a apresentação vigente de uma visão até que ela seja explicitamente migrada.

---

## 6. Atualização após publicação no GitHub

No final de todas as visões do ciclo principal, o player executa um reload completo usando um parâmetro `_ciclo` variável.

Além disso, fragmentos, CSS e módulos são requisitados com cache-buster.

Objetivos:

- incorporar alterações publicadas no GitHub em um novo ciclo;
- reduzir reaproveitamento de HTML/CSS/JS antigo pelo navegador;
- zerar timers e estados residuais periodicamente.

Os JSONs continuam usando suas próprias estratégias de `no-store`/cache-buster.

---

## 7. PG-V2 — tela e identidade

- Área lógica: **1920×1080**.
- Proporção: **16:9**.
- Sem scroll horizontal ou vertical.
- `overflow: hidden`.
- Escala proporcional para a viewport.
- Centralizado.
- Fonte: `"Segoe UI", Arial, Helvetica, sans-serif`.

Paleta estrutural:

- Fundo: `#eef2f5`
- Superfície: `#ffffff`
- Cabeçalho: `#172331`
- Cabeçalho secundário: `#213345`
- Texto principal: `#27333d`
- Texto secundário: `#74808a`
- Bordas: `#e2e7eb`

Cabeçalho de referência: **96 px**.

### 7.1. Escala tipográfica calibrada para TV

A calibração presencial da Samsung de 55" definiu a seguinte escala como referência global do PG-V2:

| Papel visual | Referência |
|---|---:|
| Informação essencial / rótulos | **22 px** |
| Título de card | **24 px** |
| Título de seção | **28 px** |
| Título principal | **36 px** |
| Valor secundário | **32 px** |
| Valor de card | **40 px** |
| KPI padrão | **48 px** |
| KPI de destaque | **52 px** |
| Peso preferido | **700** |

Regras:

- informação necessária para compreender a tela deve usar **22 px ou mais**;
- se o conteúdo não couber mantendo 22 px, preferir abreviar, reorganizar, reduzir quantidade de elementos ou dividir a visão em Subvisões; não reduzir automaticamente a fonte para resolver densidade;
- `60 px` não deve ser usado como KPI padrão, pois foi considerado excessivo na calibração física;
- o texto secundário `#74808a` permanece aprovado para conteúdo complementar;
- `--texto-suave` deve ser reservado para conteúdo não essencial;
- em Chart.js, rótulos quantitativos, eixos e legendas devem ter como referência **22 px / peso 700**;
- rótulos internos de barras devem usar **alto contraste em relação ao fundo da própria barra**: texto claro em barra escura e texto escuro em barra clara;
- quando o rótulo não couber dentro da barra, priorizar reposicionamento externo antes de reduzir o tamanho da fonte;
- não utilizar `Chart.defaults` para impor tipografia global em runtime, pois o painel é SPA e isso pode afetar visões carregadas posteriormente. Usar `PAINEL_CONFIG.tipografia` como fonte de referência e aplicar explicitamente nas opções de cada gráfico.

Tokens CSS de referência ficam em `css/painel-base.css` com prefixo `--tv-`. A referência equivalente para JavaScript/Chart.js fica em `PAINEL_CONFIG.tipografia`. As visões existentes podem permanecer temporariamente com valores históricos até sua migração explícita para este padrão.

---

## 8. DC-V1 — Dia C

### Arquivos

```text
visoes/dia-c.html
css/dia-c.css
js/dia-c.js
dados.json
```

### Subvisões

Criadas dinamicamente a partir das parceiras existentes nos dados:

```text
Visão Geral
↓
Parceira 1
↓
Parceira 2
↓
...
↓
fim do ciclo DC-V1
```

Cada Subvisão permanece **15 segundos**.

A quantidade de parceiras não deve ser hardcoded.

### Dados

`dados.json` é atualizado durante a visão com intervalo padrão de 60 segundos e cache-buster. Em falha, a última informação válida deve continuar em exibição.

---

## 9. ME_EXEC-V1 — Metas da Executiva

### Arquivos

```text
visoes/metas-executiva.html
css/metas-executiva.css
js/metas-executiva.js
dados/metas-executiva.json
```

### Estrutura interna

A primeira Subvisão mostra somente registros `NIVEL = CATEGORIA`.

Depois é criada uma Subvisão para cada Categoria que possuir SubCategorias:

```text
Visão Geral
↓
Categoria com Subcategorias 1
↓
Categoria com Subcategorias 2
↓
...
↓
fim do ciclo ME_EXEC-V1
```

A quantidade de detalhamentos não deve ser hardcoded.

Cada Subvisão permanece **15 segundos**.

### Gráfico

Ordem visual:

```text
INDICADOR | PESO | BARRA / ESCALA | NOTA
```

Escala:

```text
0 a 15
```

Referências verticais:

```text
8,0
10,0
```

Categorias:

```text
< 8        #D4353E
>= 8 < 10  #F9CD17
>= 10      #458039
```

SubCategorias usam tons mais claros equivalentes:

```text
< 8        #E8787E
>= 8 < 10  #FBE37A
>= 10      #7FB06F
```

### Referência visual da ME_EXEC-V1

Preservar o padrão visual aprovado em 02/10/2026:

- o corpo da visão inicia diretamente no painel `Apuração dos Indicadores`; não exibir o antigo título interno, descrição interna, badge de quantidade nem o texto auxiliar da escala;
- a legenda de faixas (`< 8`, `8 a < 10`, `≥ 10`) fica imediatamente após `Apuração dos Indicadores`, na mesma faixa horizontal;
- no canto superior direito do painel existe um cartão horizontal compacto `Nota Geral`, exibido em todas as Subvisões;
- o cartão `Nota Geral` exibe somente o rótulo e o valor, sem texto complementar;
- a `Nota Geral` é calculada pela soma de `APURADO × PESO / 100`, considerando somente registros `NIVEL = CATEGORIA` e desconsiderando SubCategorias;
- a cor do cartão `Nota Geral` segue as mesmas faixas de desempenho da visão;
- Visão Geral mostra somente Categorias em cards compactos alinhados visualmente às demais Subvisões;
- na Visão Geral, o detalhe diagonal no canto superior esquerdo da Categoria permanece reduzido em aproximadamente 50%;
- Categoria principal no detalhamento permanece em card azul-claro, com ícone de barras e detalhe diagonal no canto superior esquerdo, no mesmo conceito dos cartões da DC-V1; a cor do detalhe diagonal segue a faixa da nota da Categoria;
- nome da Categoria pode ocupar até duas linhas;
- SubCategorias em cards individuais recuados;
- hierarquia Categoria → SubCategorias indicada por linha vertical, ramificações e nós;
- colunas `Peso`, `Barra / Escala` e `Nota` permanecem alinhadas entre Categoria e SubCategorias;
- a altura das linhas não deve ser distribuída elasticamente para preencher todo o painel; cada tipo de linha usa altura visual fixa para preservar padrão entre Subvisões;
- Nota exibida em badge tonalizado pela mesma faixa de desempenho;
- somente as linhas verticais de referência em `8,0` e `10,0` permanecem na escala;
- o cabeçalho da escala exibe marcadores triangulares apontando para baixo, com rótulos `8,0` e `10,0`, coloridos conforme a régua de desempenho;
- rótulos numéricos do eixo X não são exibidos além desses marcadores de referência.

### Formato do JSON

O formato canônico de `dados/metas-executiva.json` é uma **lista direta de registros na raiz**:

```json
[
  {
    "INDICADOR": "...",
    "APURADO": 0,
    "PESO": 0,
    "PONDERADO": null,
    "CATEGORIA": "...",
    "NIVEL": "CATEGORIA",
    "SUBCATEGORIA": "",
    "ORDEM_CAT": 1,
    "ORDEM_SUB": 0
  }
]
```

O módulo `js/metas-executiva.js` mantém compatibilidade de leitura com o formato legado `{ "versao": "ME_EXEC-V1", "dados": [...] }`, mas novos arquivos devem usar o array direto.

### Campos do JSON

- `INDICADOR`
- `APURADO`
- `PESO`
- `PONDERADO`
- `CATEGORIA`
- `NIVEL`
- `SUBCATEGORIA`
- `ORDEM_CAT`
- `ORDEM_SUB`

Ordenação:

```text
ORDEM_CAT → ORDEM_SUB
```

---

## 10. ME_GER-V1 — Metas da Gerência

### Arquivos

```text
visoes/metas-gerencia.html
css/metas-gerencia.css
js/metas-gerencia.js
dados/metas-gerencia.json
```

A **ME_GER-V1** replica o comportamento e o padrão visual da **ME_EXEC-V1**. A diferença funcional entre as duas visões é a fonte de dados:

```text
ME_EXEC-V1 → dados/metas-executiva.json
ME_GER-V1  → dados/metas-gerencia.json
```

Portanto, ME_GER-V1 preserva:

- Visão Geral somente com Categorias;
- criação automática de uma Subvisão para cada Categoria que possua SubCategorias;
- 15 segundos por Subvisão;
- cartão horizontal compacto `Nota Geral` em todas as telas;
- cálculo da Nota Geral por `APURADO × PESO / 100`, considerando somente `NIVEL = CATEGORIA`;
- escala de 0 a 15;
- linhas de referência e marcadores em `8,0` e `10,0`;
- mesmas regras de cores de Categoria e SubCategoria da ME_EXEC-V1;
- mesma composição de cards, hierarquia, Peso, barras e badges de Nota;
- atualização de dados a cada 60 segundos, com cache-buster e preservação da última informação válida em caso de falha.

O formato de `dados/metas-gerencia.json` segue os mesmos campos e a mesma ordenação usados pela ME_EXEC-V1.

---

## 11. COM-V1 — Comissionamento de Obras

### Arquivos

```text
visoes/comissionamento.html
css/comissionamento.css
js/comissionamento.js
dados/base_comissionamento.json
```

A **COM-V1** acompanha o volume financeiro das obras sinalizadas para comissionamento, o resultado da análise e o faturamento associado às obras já comissionadas.

Título exibido no cabeçalho da visão: **Comissionamento**.

### Status financeiros

```text
CONC  → obras ainda não analisadas
PEND  → obras com pendências
COMS  → obras comissionadas
Faturado Comissionamento → parcela das obras comissionadas já faturada
```

### Composição das Subvisões

A COM-V1 possui **duas Subvisões internas**, ambas dentro do mesmo fragmento e do mesmo módulo:

**Tela 1 — Consolidado e últimos 2 meses por parceira**

1. A coluna esquerda ocupa **44% da largura** (10% a mais que a largura anterior de 40%). No topo ficam três cartões horizontais com os valores do mês atual para `COMS`, `CONC` e `PEND`; cada cartão usa no canto superior esquerdo o detalhe diagonal já adotado em outras visões, com a mesma cor da respectiva série na legenda. Abaixo desses KPIs fica a área **COMS x Faturado — Consolidado**, que consome o restante da altura da coluna. No mês anterior, a barra exibe somente `COMS`; no último mês, a barra é empilhada em `COMS + CONC + PEND`, representando a projeção de comissionamento. `Faturado Comissionamento` é exibido como linha em degrau (“malhete”), tracejada e sem marcadores. O painel lateral segue a ordem Comissionado → Projeção de Comissionamento → Faturado;
2. **Últimos 2 meses por parceira** ocupa os **56% restantes da largura** e 100% da altura útil. Os *small multiples* são distribuídos **verticalmente**, um por parceira, mantendo a mesma semântica visual do Consolidado. Em cada mini-gráfico, o mês anterior exibe somente `COMS`; o mês atual empilha `COMS + CONC + PEND`; `Faturado Comissionamento` é uma linha em degrau (“malhete”), tracejada e sem marcadores. Cada mini-gráfico utiliza **escala Y independente**, calculada a partir dos próprios valores da parceira. Os rótulos financeiros das barras usam posicionamento dinâmico: permanecem centralizados quando cabem dentro do segmento e, quando o espaço interno é insuficiente, tentam ocupar uma posição externa segura ao lado ou acima do elemento; somente são ocultados quando não existe espaço útil sem colisão evidente. Na lateral direita de cada *small multiple*, os cartões **Comissionado → Projeção de Comissionamento → Faturado** permanecem organizados verticalmente.

**Tela 2 — Históricos dos últimos 6 meses**

3. Os históricos de **PRETEL**, **DPL** e **CENA** ocupam individualmente **100% da largura útil** e aproximadamente **1/3 da altura**, empilhados verticalmente nessa ordem;
4. Cada histórico exibe os últimos 6 meses de `COMS` + linha de faturado e mantém, na lateral direita, somente **Média de comissionamento** e **Média de faturamento**, organizadas verticalmente. A formatação interna dos gráficos segue as propriedades visuais do gráfico **COMS x Faturado — Consolidado** da Tela 1, sem alterar as dimensões dos cards da Tela 2.

Regras da visualização:

- as duas Subvisões não exibem subtítulos internos nos painéis nem subtítulo no cabeçalho global da COM-V1;
- na Tela 1, os três cartões de status acima do Consolidado exibem `COMS`, `CONC` e `PEND` do último mês disponível; o detalhe diagonal no canto superior esquerdo segue a cor da respectiva série; o nome do mês não é repetido dentro dos três cartões, pois o período é comum à faixa e já está representado pelos gráficos da Subvisão;
- os cartões internos do painel lateral do Consolidado e dos *small multiples* usam superfície branca, borda e sombra discretas para se destacarem do fundo que os contém;
- no consolidado, o mês anterior exibe somente `COMS`; o último mês empilha `COMS`, `CONC` e `PEND`;
- no consolidado, `Projeção de Comissionamento = COMS + CONC + PEND` do mês atual e sua variação compara essa projeção contra o `COMS` do mês anterior;
- no consolidado, `Faturado Comissionamento` usa linha em degrau (“malhete”), tracejada e sem marcadores;
- no consolidado, a legenda do gráfico combinado segue a referência TV22 de **22 px / peso 700**; as amostras visuais foram redimensionadas para preservar equilíbrio com essa tipografia;
- nos demais gráficos de barras, permanece a regra específica já documentada para cada composição;
- `Faturado Comissionamento` é exibido como linha no consolidado, nos *small multiples* por parceira e nos históricos de 6 meses;
- na Tela 1, o Consolidado e todos os *small multiples* utilizam os dois últimos meses existentes no JSON;
- na Tela 2, os três históricos utilizam os seis últimos meses existentes no JSON;
- nos *small multiples* por parceira, os cartões usam as mesmas regras do consolidado: Comissionado compara `COMS` atual versus `COMS` anterior; Projeção compara `COMS + CONC + PEND` atual versus `COMS` anterior; Faturado compara faturamento atual versus faturamento anterior;
- nos *small multiples* da Tela 1, os rótulos quantitativos usam posicionamento dinâmico por elemento: quando o texto cabe, permanece centralizado dentro da barra; quando não cabe, o módulo tenta deslocá-lo para uma lateral ou para o topo, conforme o espaço real do `chartArea`; `CONC` prioriza a direita, `PEND` prioriza a esquerda e `COMS` escolhe automaticamente o lado mais adequado; o rótulo só é omitido quando nenhuma posição segura estiver disponível;
- os três cartões de cada *small multiple* ficam na lateral direita do mini-gráfico, organizados verticalmente;
- na Tela 1, a distribuição principal é de aproximadamente **44% para o Consolidado e 56% para Últimos 2 meses por parceira**; dentro de cada *small multiple*, a redução de largura é absorvida prioritariamente pelo gráfico combinado, enquanto a coluna de cartões permanece preservada; após a migração TV22, cada cartão usa duas linhas visuais: rótulo + referência comparativa na primeira linha e valor financeiro + variação percentual na segunda, todos preservando o mínimo essencial de 22 px; o rótulo `Projeção de Comissionamento` é abreviado visualmente para `Projeção` apenas nesses cartões compactos; os títulos dos cartões da Tela 1 usam capitalização em frase, preservando siglas técnicas como `COMS`, `CONC` e `PEND`;
- no painel lateral do Consolidado, os textos de referência (`vs. <mês>`) usam **22 px / peso 700**, alinhados ao piso tipográfico calibrado;
- no painel lateral do Consolidado, cada cartão organiza verticalmente o valor principal e o percentual de variação: valor na primeira linha, chip percentual abaixo e referência comparativa na sequência;
- nos cartões laterais dos *small multiples* da Tela 1, os percentuais de variação versus o mês anterior e os textos de referência (`vs. <mês>`) usam **22 px / peso 700**; a composição em duas linhas visuais preserva a exibição integral dessas referências, sem recorte inferior; a indicação visual da Projeção também usa apenas `vs. <mês>`, embora a fórmula continue comparando a projeção atual com o `COMS` do mês anterior;
- nos históricos de 6 meses, o painel lateral mantém somente Média de comissionamento e Média de faturamento, empilhadas verticalmente;
- no comparativo por parceira, o mês anterior usa somente `COMS` e o mês atual representa a projeção com `COMS + CONC + PEND`;
- nos históricos da Tela 2, as barras de `COMS` usam o mesmo gradiente, raio e proporções do Consolidado; a linha de Faturado usa o mesmo traçado em degrau, tracejado e sem marcadores; os rótulos das barras usam a mesma lógica dinâmica de posicionamento do Consolidado e os rótulos da linha alternam acima/abaixo conforme o espaço vertical disponível; as dimensões dos cards e dos gráficos permanecem inalteradas;
- Média de comissionamento e Média de faturamento são calculadas sobre os seis meses exibidos no respectivo histórico e são os únicos indicadores mantidos no painel lateral dos históricos; a repetição textual `últimos 6 meses` foi removida de dentro desses cartões, pois o período já aparece no título do histórico;
- A COM-V1 foi migrada para a escala tipográfica calibrada do PG-V2: `TIPOGRAFIA_GRAFICOS`, dentro de `js/comissionamento.js`, consome `PAINEL_CONFIG.tipografia.grafico`; rótulos quantitativos e rótulos do eixo X usam **22 px / peso 700**. Não alterar `Chart.defaults`, para evitar efeito colateral nas demais visões do PG-V2;
- os eixos Y não exibem régua ou rótulos;
- valores das barras são mostrados diretamente no gráfico; no Consolidado, `COMS`, `CONC` e `PEND` usam a mesma lógica dinâmica de posicionamento e contraste contextual (texto claro em barra escura, texto escuro em barra clara);
- o consolidado também mostra os valores da linha de faturado; os rótulos da linha priorizam posição acima do traçado e migram para baixo quando necessário; valores nulos/zero da linha não recebem rótulo para evitar ruído visual; os rótulos de barras seguem a lógica de priorizar o interior da barra e usar posição externa quando necessário;
- o painel lateral do consolidado não exibe Conversão e segue a ordem: Comissionado, Projeção de Comissionamento e Faturado;
- variações mensais de COMS e faturado usam `(atual - anterior) / anterior × 100`; a projeção usa `(COMS + CONC + PEND do mês atual - COMS do mês anterior) / COMS do mês anterior × 100`;
- meses são ordenados por `MES_ORDEM`;
- parceiras são obtidas dinamicamente do JSON e não ficam hardcoded no módulo.

### Migração tipográfica TV22

Em 07/10/2026, a COM-V1 tornou-se a primeira visão produtiva explicitamente migrada para a referência tipográfica calibrada da TV. A composição utiliza **22 px / peso 700** como piso para informação essencial, **24 px** para títulos de cards/seções compactas e **32 px** para valores secundários. Onde a composição anterior não comportava essa escala, a informação foi reorganizada sem reduzir a fonte: referências comparativas dos cartões dos *small multiples* passaram para a mesma linha do rótulo, textos redundantes de período foram removidos e a coluna lateral dos históricos foi redistribuída internamente.

A COM-V1 possui **2 Subvisões internas de 15 segundos cada**. A Tela 1 é exibida por 15 segundos, depois a Tela 2 por mais 15 segundos; somente após a segunda tela o módulo devolve o controle ao player. No modo `?dev=1`, `→` e `←` navegam entre essas duas Subvisões seguindo as regras globais do PG-V2.

### Dados

O formato canônico de `dados/base_comissionamento.json` é uma lista direta de registros na raiz. Campos utilizados:

- `QTD_NOTAS`;
- `MES_ORDEM`;
- `MES`;
- `PARCEIRA`;
- `CONC`;
- `PEND`;
- `COMS`;
- `Faturado Comissionamento`.

O JSON é carregado uma única vez na entrada da COM-V1, usando `no-store` e cache-buster, e é compartilhado pelas duas Subvisões. Não há temporizador próprio de atualização durante os **30 segundos do ciclo interno** (15 s por tela). Uma nova leitura ocorre naturalmente quando a COM-V1 for carregada novamente em um novo ciclo do painel. Falhas de gráfico são tratadas localmente e não devem interromper o player.

---

## 11.1. CAL-TV — Referência tipográfica calibrada

### Arquivos

```text
visoes/calibracao-tv.html
css/calibracao-tv.css
js/calibracao-tv.js
```

A **CAL-TV** é uma visão técnica estática, sem fonte de dados externa e fora da rotação normal do painel. Após a calibração física, ela passou a funcionar como **referência visual oficial da escala tipográfica do PG-V2**.

A tela apresenta quatro grupos de referência:

1. escala oficial com **22 px** para informação essencial, **24 px** para título de card, **28 px** para título de seção e **36 px** para título principal;
2. peso **700** como padrão preferido e comparação dos contrastes principal, secundário e suave;
3. hierarquia de valores com **32 px** para valor secundário, **40 px** para valor de card, **48 px** para KPI padrão e **52 px** como destaque máximo recomendado;
4. gráfico Chart.js real com rótulos, eixo e texto em **22 px / peso 700**, demonstrando contraste adaptado à cor da barra: texto branco em barras escuras e texto escuro em barras claras.

A CAL-TV deve permanecer integralmente dentro de 1920×1080, sem scroll. Ela documenta o padrão calibrado, mas não deve forçar alterações automáticas nas visões produtivas já existentes; cada visão deve ser migrada explicitamente e validada em 1920×1080.

Acesso técnico:

```text
?cal=1
```

---

## 12. Como criar uma nova visão no PG-V2

1. Criar fragmento em `visoes/`.
2. Criar CSS específico em `css/`.
3. Criar módulo JS em `js/` com `iniciar()` e `destruir()`.
4. Criar fonte de dados, se necessária.
5. Registrar a visão em `PAINEL_CONFIG.visoes`, incluindo `ativo: true` ou `ativo: false`.
6. Garantir que `iniciar()` só termine quando toda a apresentação daquela visão tiver sido concluída.
7. Tratar erros localmente para não derrubar o player.
8. Validar em 1920×1080 e confirmar ausência de scroll.

---

## 12.1. Habilitar e desabilitar visões

A exibição de uma visão deve ser controlada exclusivamente pelo registro em `js/painel-config.js`; não apagar arquivos, comentar blocos inteiros nem alterar `painel-player.js` para suspender temporariamente uma visão.

Exemplo:

```js
{
    id: "ME_EXEC-V1",
    ativo: false,
    nome: "Metas da Executiva",
    titulo: "Metas da Executiva",
    subtitulo: "Acompanhamento das notas por Categoria",
    fragmento: "./visoes/metas-executiva.html",
    css: "./css/metas-executiva.css",
    modulo: "./js/metas-executiva.js"
}
```

Com `ativo: false`, a visão continua integralmente no repositório, mas não é carregada nem apresentada. Para reativá-la, alterar somente para:

```js
ativo: true
```

A ordem dos objetos ativos em `PAINEL_CONFIG.visoes` continua determinando a ordem de apresentação.

---

## 13. Alteração global x específica

### Global — PG-V2

Modificar arquivos compartilhados somente quando a alteração deve valer para todas as visões:

```text
index.html
css/painel-base.css
js/painel-config.js
js/painel-base.js
js/painel-player.js
```

### DC-V1

Preferir:

```text
visoes/dia-c.html
css/dia-c.css
js/dia-c.js
dados.json
```

### ME_EXEC-V1

Preferir:

```text
visoes/metas-executiva.html
css/metas-executiva.css
js/metas-executiva.js
dados/metas-executiva.json
```

### ME_GER-V1

Preferir:

```text
visoes/metas-gerencia.html
css/metas-gerencia.css
js/metas-gerencia.js
dados/metas-gerencia.json
```

### COM-V1

Preferir:

```text
visoes/comissionamento.html
css/comissionamento.css
js/comissionamento.js
dados/base_comissionamento.json
```

### CAL-TV

Preferir:

```text
visoes/calibracao-tv.html
css/calibracao-tv.css
js/calibracao-tv.js
```

O registro e o acesso técnico da CAL-TV dependem de `js/painel-config.js` e da regra `?cal=1` em `js/painel-player.js`; essas duas alterações são globais apenas para viabilizar o modo de calibração e não devem modificar a apresentação das visões produtivas.

Não alterar PG-V2 para resolver um problema exclusivo de uma visão.

---


## 13.1. Regra de integridade do shell e consentimento para exceções

A separação entre **shell global** e **corpo das visões** é uma regra estrutural obrigatória do PG-V2.

Regra:

```text
Shell / identidade / player global
    → index.html + css/painel-base.css + JS compartilhado

Corpo de uma visão
    → visoes/<visao>.html + css/<visao>.css + js/<visao>.js + dados
```

Se uma solicitação futura exigir ou induzir uma implementação que viole essa separação — por exemplo, colocar em `css/metas-executiva.css` uma regra que altere `.topo` ou `#stage` — **não implementar automaticamente**.

Antes de abrir uma exceção, é obrigatório:

1. explicar ao usuário qual regra do PG-V2 seria contrariada;
2. explicar por que a solicitação exigiria desconsiderar a regra e quais efeitos colaterais/manutenções adicionais podem ocorrer;
3. indicar, quando existir, uma alternativa compatível com o PG-V2;
4. solicitar consentimento explícito do usuário para a exceção;
5. somente após o consentimento, implementar a exceção e registrá-la no README, com escopo e justificativa.

**Sem consentimento explícito, prevalece a regra do PG-V2 e a exceção não deve ser aplicada.**

Essa exigência vale também para alterações solicitadas em conversas futuras, desde que este README permaneça vigente no repositório recebido.

---

## 14. Procedimento obrigatório ao receber um ZIP

```text
1. Extrair o ZIP
2. Localizar README.md na raiz
3. Ler README.md integralmente
4. Identificar a visão pela sigla canônica
5. Inspecionar os arquivos vigentes da visão
6. Inspecionar PG-V2 somente se necessário
7. Realizar a alteração no menor conjunto possível de arquivos
8. Validar sintaxe e referências
9. Validar 1920×1080 / ausência de scroll
10. Entregar o repositório atualizado e, quando útil, apenas os arquivos alterados
```

Nunca reconstruir arquivos vigentes com base apenas em versões históricas do chat.

---

## 15. Histórico de arquitetura

### PG-V1 — legado

- múltiplas páginas HTML completas;
- `index.html` alternava `iframe`s;
- cada visão possuía seu próprio cabeçalho e estrutura completa;
- sincronização entre duração do player e loops internos tornou-se complexa.

### PG-V2 — vigente

- único `index.html`;
- shell/cabeçalho/fundo global estilizados exclusivamente em `css/painel-base.css`;
- fragmentos HTML modulares com classe raiz própria;
- CSS específico carregado por visão e restrito ao corpo do módulo;
- módulos JS com ciclo de vida explícito;
- sequência principal baseada em `await modulo.iniciar()`;
- reload completo ao fim de cada ciclo principal.

---

**Padrão vigente: PG-V2**  
**Visões cadastradas: DC-V1, ME_EXEC-V1, ME_GER-V1, COM-V1 e CAL-TV**  
**Estado atual em `painel-config.js`: DC-V1 e CAL-TV desativadas na rotação; ME_EXEC-V1, ME_GER-V1 e COM-V1 ativas. CAL-TV pode ser aberta isoladamente com `?cal=1`.**


### Inicialização visual do PG-V2

O player **não possui tela inicial de carregamento**. O `index.html` inicia com o shell visualmente oculto e carrega imediatamente a primeira visão configurada. Assim que o fragmento HTML e o CSS dessa visão estão disponíveis, o shell é revelado diretamente com a primeira visão. A transição de fade é aplicada apenas entre visões já em execução, nunca antes da primeira visão. Não usar textos como “Painel de Acompanhamento”, “Carregando visão...” ou “Preparando apresentação...” como estado visual inicial.


- Na Tela 1 da COM-V1, os títulos dos cartões de KPI (Comissionado, Projeção/Projeção de comissionamento e Faturado) ficam fora do respectivo cartão, acima e alinhados à esquerda, tanto no Consolidado quanto nos small multiples.
- Os títulos dos quadrantes “COMS x Faturado — Consolidado” e “Últimos 2 meses por parceira” permanecem no cabeçalho dos respectivos quadrantes.
- Os cartões superiores COMS/CONC/PEND usam tipografia de 24 px nos rótulos e 30 px nos valores, com hierarquia superior aos demais cartões da Tela 1.
