/* ================================================================
   METAS DA EXECUTIVA — ME_EXEC-V1
   Lógica específica da visão.
   ================================================================ */

const TEMPO_PADRAO_VISAO =
    Number(window.PAINEL_CONFIG?.player?.tempoPadraoSegundos) || 15;

const ESCALA_MAXIMA = 15;

const URL_DADOS =
    "./dados/metas-executiva.json";

const TEMPO_ATUALIZACAO_DADOS =
    Number(
        window.PAINEL_CONFIG
            ?.atualizacao
            ?.intervaloPadraoMs
    )
    || 60000;

const DURACAO_TRANSICAO_CONTEUDO =
    Number(
        window.PAINEL_CONFIG
            ?.transicoes
            ?.conteudoMs
    )
    || 230;


let dadosGlobais = [];

let visoes = [
    {
        tipo: "geral",
        chave: "geral",
        nome: "VISÃO GERAL"
    }
];

let indiceVisaoAtual = 0;

let duracaoTelaAtual = TEMPO_PADRAO_VISAO;

let segundosRestantes =
    duracaoTelaAtual;

let temporizadorRotacao =
    null;

let temporizadorAtualizacao = null;
let resolverCiclo = null;
let cicloAtivo = false;
let pausado = false;


/* ================================================================
   FUNÇÕES AUXILIARES
   ================================================================ */

function numero(valor) {

    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {
        return 0;
    }

    if (
        typeof valor ===
        "number"
    ) {

        return Number.isFinite(valor)
            ? valor
            : 0;

    }

    let texto =
        String(valor)
            .trim();

    if (
        texto.includes(",")
    ) {

        texto =
            texto
                .replace(/\./g, "")
                .replace(",", ".");

    }

    const resultado =
        Number(texto);

    return Number.isFinite(resultado)
        ? resultado
        : 0;

}


function textoCampo(
    registro,
    ...nomes
) {

    for (
        const nome of nomes
    ) {

        const valor =
            registro?.[nome];

        if (
            valor !== null &&
            valor !== undefined &&
            String(valor).trim() !== ""
        ) {

            return String(valor)
                .trim();

        }

    }

    return "";

}


function limparRotulo(texto) {

    return String(texto || "")
        .replace(
            /\s*-\s*EQTL PI\s*-\s*REG METROPOLITANA/gi,
            ""
        )
        .replace(
            /\s*-\s*EQTL PI/gi,
            ""
        )
        .replace(/\s+/g, " ")
        .trim();

}


function formatarNota(valor) {

    return numero(valor)
        .toLocaleString(
            "pt-BR",
            {
                minimumFractionDigits: 1,
                maximumFractionDigits: 2
            }
        );

}


function formatarNotaGeral(valor) {

    return numero(valor)
        .toLocaleString(
            "pt-BR",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );

}


function formatarPeso(valor) {

    return numero(valor)
        .toLocaleString(
            "pt-BR",
            {
                maximumFractionDigits: 2
            }
        );

}


function normalizarRegistro(
    registro,
    indice
) {

    const nivelOriginal =
        textoCampo(
            registro,
            "NIVEL",
            "nivel"
        )
        .toUpperCase();

    const subcategoria =
        textoCampo(
            registro,
            "SUBCATEGORIA",
            "subcategoria"
        );

    const nivel =
        nivelOriginal === "SUBCATEGORIA"
        || (
            !nivelOriginal &&
            subcategoria
        )
        ? "SUBCATEGORIA"
        : "CATEGORIA";

    return {
        indicador:
            textoCampo(
                registro,
                "INDICADOR",
                "indicador"
            ),

        apurado:
            numero(
                registro?.APURADO
                ?? registro?.apurado
            ),

        peso:
            numero(
                registro?.PESO
                ?? registro?.peso
            ),

        ponderado:
            registro?.PONDERADO
            ?? registro?.ponderado
            ?? null,

        categoria:
            textoCampo(
                registro,
                "CATEGORIA",
                "categoria"
            ),

        nivel,

        subcategoria,

        ordemCat:
            numero(
                registro?.ORDEM_CAT
                ?? registro?.ordemCat
            ),

        ordemSub:
            numero(
                registro?.ORDEM_SUB
                ?? registro?.ordemSub
            ),

        indiceOriginal:
            indice
    };

}


function ordenarDados(dados) {

    return [...dados]
        .sort(
            (
                a,
                b
            ) => {

                if (
                    a.ordemCat !==
                    b.ordemCat
                ) {

                    return (
                        a.ordemCat
                        -
                        b.ordemCat
                    );

                }

                if (
                    a.ordemSub !==
                    b.ordemSub
                ) {

                    return (
                        a.ordemSub
                        -
                        b.ordemSub
                    );

                }

                return (
                    a.indiceOriginal
                    -
                    b.indiceOriginal
                );

            }
        );

}


function chaveCategoria(registro) {

    if (
        numero(registro?.ordemCat) > 0
    ) {

        return (
            "ordem:"
            +
            numero(registro.ordemCat)
        );

    }

    return (
        "nome:"
        +
        String(
            registro?.categoria || ""
        )
        .trim()
        .toLocaleLowerCase("pt-BR")
    );

}


function obterCategorias() {

    return ordenarDados(
        dadosGlobais
            .filter(
                item =>
                    item.nivel ===
                    "CATEGORIA"
            )
    );

}


function calcularNotaGeralCategorias() {

    return obterCategorias()
        .reduce(
            (
                acumulado,
                item
            ) => (
                acumulado
                +
                (
                    numero(item.apurado)
                    *
                    numero(item.peso)
                    /
                    100
                )
            ),
            0
        );

}


function obterSubcategorias(
    categoria
) {

    const chave =
        chaveCategoria(
            categoria
        );

    return ordenarDados(
        dadosGlobais
            .filter(
                item =>
                    item.nivel ===
                    "SUBCATEGORIA"
                    &&
                    chaveCategoria(item)
                    ===
                    chave
            )
    );

}


function nomeCurtoVisao(
    categoria
) {

    const nome =
        limparRotulo(
            categoria
        )
        .toUpperCase();

    if (
        nome.includes(
            "GESTÃO TORRE RD"
        )
    ) {
        return "GESTÃO TORRE RD";
    }

    if (
        nome.includes(
            "QUALIDADE E ADERÊNCIA DA FISCALIZAÇÃO"
        )
    ) {
        return "QUALIDADE E FISCALIZAÇÃO";
    }

    if (
        nome.includes(
            "SUSTENÇÃO DE SISTEMAS"
        )
    ) {
        return "SISTEMAS DE GESTÃO";
    }

    if (
        nome.includes(
            "CUMPRIMENTO TORRE INVESTIMENTOS"
        )
    ) {
        return "TORRE INVESTIMENTOS";
    }

    return nome;

}


function classeFaixa(valor) {

    if (valor < 8) {
        return "faixa-critica";
    }

    if (valor < 10) {
        return "faixa-atencao";
    }

    return "faixa-meta";

}


function classeFaixaReferencia(valor) {

    return classeFaixa(
        numero(valor)
    );

}


function corDaBarra(
    valor,
    ehSubcategoria
) {

    if (
        ehSubcategoria
    ) {

        if (
            valor < 8
        ) {
            return "#E8787E";
        }

        if (
            valor < 10
        ) {
            return "#FBE37A";
        }

        return "#7FB06F";

    }

    if (
        valor < 8
    ) {
        return "#D4353E";
    }

    if (
        valor < 10
    ) {
        return "#F9CD17";
    }

    return "#458039";

}


/* ================================================================
   VISÕES INTERNAS
   ================================================================ */

function atualizarListaVisoes() {

    const chaveAtual =
        visoes[
            indiceVisaoAtual
        ]?.chave;

    const categorias =
        obterCategorias();

    const detalhes = [];

    for (
        const categoria of categorias
    ) {

        const subcategorias =
            obterSubcategorias(
                categoria
            );

        if (
            subcategorias.length === 0
        ) {
            continue;
        }

        detalhes.push({
            tipo: "detalhe",
            chave:
                "detalhe:"
                +
                chaveCategoria(
                    categoria
                ),
            nome:
                nomeCurtoVisao(
                    categoria.categoria
                ),
            categoria,
            subcategorias
        });

    }

    visoes = [
        {
            tipo: "geral",
            chave: "geral",
            nome: "VISÃO GERAL"
        },
        ...detalhes
    ];

    const novoIndice =
        visoes.findIndex(
            visao =>
                visao.chave ===
                chaveAtual
        );

    indiceVisaoAtual =
        novoIndice >= 0
        ? novoIndice
        : 0;

}


function obterVisaoAtual() {

    return (
        visoes[
            indiceVisaoAtual
        ]
        ||
        visoes[0]
    );

}


function obterTempoVisaoAtual() {

    const visao =
        obterVisaoAtual();

    return (
        window.PAINEL_BASE
            ?.obterTempoTela?.(
                "ME_EXEC-V1",
                visao?.chave,
                visao?.tipo,
                "principal"
            )
        || TEMPO_PADRAO_VISAO
    );

}


function reiniciarContagemVisaoAtual() {

    duracaoTelaAtual =
        obterTempoVisaoAtual();

    segundosRestantes =
        duracaoTelaAtual;

}


function obterItensVisaoAtual() {

    const visao =
        obterVisaoAtual();

    if (
        visao.tipo ===
        "geral"
    ) {

        return obterCategorias();

    }

    return [
        visao.categoria,
        ...visao.subcategorias
    ];

}


function obterProximaVisao() {

    const proximoIndice =
        indiceVisaoAtual + 1;

    if (proximoIndice >= visoes.length) {
        return null;
    }

    return visoes[proximoIndice];

}


function pararRotacao() {

    if (temporizadorRotacao) {
        clearInterval(temporizadorRotacao);
        temporizadorRotacao = null;
    }

}


function concluirCiclo() {

    if (!cicloAtivo) return;

    cicloAtivo = false;
    pararRotacao();

    const contador = document.getElementById("contador");
    const barra = document.getElementById("barraTempo");

    if (contador) contador.textContent = "0s";
    if (barra) barra.style.width = "0%";

    const resolver = resolverCiclo;
    resolverCiclo = null;

    if (resolver) resolver();

}


function avancarVisao() {

    if (!cicloAtivo) return;

    const proximoIndice =
        indiceVisaoAtual + 1;

    if (proximoIndice >= visoes.length) {
        concluirCiclo();
        return;
    }

    indiceVisaoAtual = proximoIndice;
    reiniciarContagemVisaoAtual();
    trocarVisaoComTransicao();

}


function trocarVisaoComTransicao() {

    const painel = document.getElementById("painelConteudo");

    if (!painel) {
        concluirCiclo();
        return;
    }

    painel.classList.add("trocando");

    setTimeout(() => {
        if (!cicloAtivo) return;
        renderizarVisao();
        painel.classList.remove("trocando");
    }, DURACAO_TRANSICAO_CONTEUDO);

}


function iniciarRotacao() {

    pararRotacao();
    cicloAtivo = true;
    reiniciarContagemVisaoAtual();
    atualizarContador();

    temporizadorRotacao = setInterval(() => {

        if (!cicloAtivo || pausado) return;

        segundosRestantes--;

        if (segundosRestantes <= 0) {
            avancarVisao();
        }

        atualizarContador();

    }, 1000);

}


function atualizarContador() {

    const contador = document.getElementById("contador");
    const barra = document.getElementById("barraTempo");

    if (!contador || !barra) return;

    contador.textContent =
        `${segundosRestantes}s`;

    const percentual = Math.max(
        0,
        (segundosRestantes / duracaoTelaAtual) * 100
    );

    barra.style.width = percentual + "%";

}



/* ================================================================
   EIXO E LINHAS DO GRÁFICO
   ================================================================ */

function montarEixo() {

    const eixo =
        document.getElementById(
            "eixoMetas"
        );

    if (!eixo) {
        return;
    }

    eixo.innerHTML = "";

    const referencias = [
        { valor: 8, rotulo: "8,0" },
        { valor: 10, rotulo: "10,0" }
    ];

    for (
        const item of referencias
    ) {

        const marcador =
            document.createElement(
                "span"
            );

        marcador.className = [
            "metas-marcador",
            classeFaixaReferencia(
                item.valor
            )
        ].join(" ");

        marcador.style.left =
            (
                item.valor
                /
                ESCALA_MAXIMA
            )
            *
            100
            +
            "%";

        const badge =
            document.createElement(
                "span"
            );

        badge.className =
            "metas-marcador-badge";

        badge.textContent =
            item.rotulo;

        marcador.appendChild(
            badge
        );

        eixo.appendChild(
            marcador
        );

    }

}



function criarGrade() {

    return null;

}



function criarReferencia(
    valor
) {

    const linha =
        document.createElement(
            "span"
        );

    linha.className =
        valor === 8
        ? "meta-referencia meta-referencia-8"
        : "meta-referencia meta-referencia-10";

    linha.setAttribute(
        "aria-hidden",
        "true"
    );

    return linha;

}


function renderizarLinhas(
    itens
) {

    const container =
        document.getElementById(
            "linhasMetas"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    container.style.setProperty(
        "--qtd-linhas",
        Math.max(
            itens.length,
            1
        )
    );

    for (
        const item of itens
    ) {

        const ehSubcategoria =
            item.nivel ===
            "SUBCATEGORIA";

        const valor =
            Math.max(
                0,
                numero(
                    item.apurado
                )
            );

        const percentual =
            Math.min(
                (
                    valor
                    /
                    ESCALA_MAXIMA
                )
                *
                100,
                100
            );

        const linha =
            document.createElement(
                "div"
            );

        linha.className = [
            "meta-linha",
            ehSubcategoria
                ? "meta-subcategoria"
                : "meta-categoria",
            classeFaixa(valor),
            valor === 0
                ? "valor-zero"
                : ""
        ]
        .filter(Boolean)
        .join(" ");


        const rotulo =
            document.createElement(
                "div"
            );

        rotulo.className =
            "meta-rotulo";


        const rotuloTexto =
            document.createElement(
                "div"
            );

        rotuloTexto.className =
            "meta-rotulo-texto";

        const textoOriginal =
            ehSubcategoria
            ? (
                item.subcategoria
                ||
                item.indicador
            )
            : (
                item.categoria
                ||
                item.indicador
            );

        rotuloTexto.textContent =
            limparRotulo(
                textoOriginal
            );

        rotuloTexto.title =
            textoOriginal;

        rotulo.appendChild(
            rotuloTexto
        );


        const peso =
            document.createElement(
                "div"
            );

        peso.className =
            "meta-peso";

        peso.textContent =
            formatarPeso(
                item.peso
            )
            +
            "%";


        const areaBarra =
            document.createElement(
                "div"
            );

        areaBarra.className =
            "meta-area-barra";

        const grade =
            criarGrade();

        if (grade) {
            areaBarra.appendChild(
                grade
            );
        }

        areaBarra.appendChild(
            criarReferencia(8)
        );

        areaBarra.appendChild(
            criarReferencia(10)
        );


        const barra =
            document.createElement(
                "div"
            );

        barra.className =
            "meta-barra";

        barra.style.width =
            percentual + "%";

        barra.style.backgroundColor =
            corDaBarra(
                valor,
                ehSubcategoria
            );

        areaBarra.appendChild(
            barra
        );


        const nota =
            document.createElement(
                "div"
            );

        nota.className =
            "meta-nota";

        nota.textContent =
            formatarNota(
                valor
            );


        linha.appendChild(
            rotulo
        );

        linha.appendChild(
            peso
        );

        linha.appendChild(
            areaBarra
        );

        linha.appendChild(
            nota
        );

        container.appendChild(
            linha
        );

    }

}


/* ================================================================
   TEXTOS / RENDERIZAÇÃO DA VISÃO
   ================================================================ */

function atualizarTextosVisao(
    itens
) {

    const visao =
        obterVisaoAtual();

    const conteudo =
        document.getElementById(
            "painelConteudo"
        );

    const nomeHeader =
        document.getElementById(
            "nomeVisaoHeader"
        );

    if (
        !conteudo ||
        !nomeHeader
    ) {
        return;
    }

    conteudo.classList.toggle(
        "modo-detalhe",
        visao.tipo ===
            "detalhe"
    );

    conteudo.classList.toggle(
        "modo-geral",
        visao.tipo ===
            "geral"
    );

    nomeHeader.textContent =
        visao.nome;

}



function atualizarCartaoNotaGeral() {

    const cartao =
        document.getElementById(
            "cartaoNotaGeral"
        );

    const valor =
        document.getElementById(
            "valorNotaGeral"
        );

    if (!cartao || !valor) {
        return;
    }

    const notaGeral =
        calcularNotaGeralCategorias();

    valor.textContent =
        formatarNotaGeral(
            notaGeral
        );

    cartao.classList.remove(
        "faixa-neutra",
        "faixa-critica",
        "faixa-atencao",
        "faixa-meta"
    );

    cartao.classList.add(
        classeFaixa(
            notaGeral
        )
    );

}


function renderizarVisao() {

    const itens =
        obterItensVisaoAtual();

    atualizarTextosVisao(
        itens
    );

    atualizarCartaoNotaGeral();

    renderizarLinhas(
        itens
    );

    atualizarContador();

}


/* ================================================================
   CARREGAMENTO DO JSON
   ================================================================ */

function extrairListaDados(payload) {

    // Formato canônico do ME_EXEC-V1: array direto na raiz.
    if (Array.isArray(payload)) {
        return payload;
    }

    // Compatibilidade com o formato legado { versao, dados }.
    if (Array.isArray(payload?.dados)) {
        return payload.dados;
    }

    return null;

}


async function carregarDados() {

    const erro =
        document.getElementById(
            "erro"
        );

    try {

        const resposta =
            await fetch(
                URL_DADOS
                +
                "?t="
                +
                Date.now(),
                {
                    cache: "no-store"
                }
            );

        if (
            !resposta.ok
        ) {

            throw new Error(
                `Erro HTTP ${resposta.status}`
            );

        }

        const json =
            await resposta.json();

        const dados =
            extrairListaDados(json);

        if (
            !Array.isArray(dados)
        ) {

            throw new Error(
                "metas-executiva.json deve conter uma lista de registros."
            );

        }

        const normalizados =
            ordenarDados(
                dados
                    .map(
                        (
                            item,
                            indice
                        ) =>
                            normalizarRegistro(
                                item,
                                indice
                            )
                    )
                    .filter(
                        item =>
                            item.categoria
                            ||
                            item.indicador
                    )
            );

        if (
            normalizados.length === 0
        ) {

            throw new Error(
                "Nenhum indicador válido foi encontrado."
            );

        }

        dadosGlobais =
            normalizados;

        atualizarListaVisoes();

        renderizarVisao();

        if (erro) {

            erro.style.display =
                "none";

            erro.textContent =
                "";

        }

        const status =
            document.getElementById(
                "statusAtualizacao"
            );

        if (status) {

            status.textContent =
                "Última atualização: "
                +
                new Date()
                    .toLocaleTimeString(
                        "pt-BR",
                        {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                        }
                    );

        }

    }
    catch (falha) {

        console.error(
            "Erro ao carregar dados das metas:",
            falha
        );

        if (erro) {

            erro.style.display =
                "block";

            erro.textContent =
                "Não foi possível atualizar os dados. A última informação carregada continuará sendo exibida.";

        }

        if (
            dadosGlobais.length > 0
        ) {

            renderizarVisao();

        }

    }

}


/* ================================================================
   CICLO DE VIDA DO MÓDULO — PG-V2
   ================================================================ */

export async function iniciar() {

    indiceVisaoAtual = 0;
    reiniciarContagemVisaoAtual();
    cicloAtivo = true;
    pausado = false;

    montarEixo();
    await carregarDados();

    // Garante que o ciclo sempre começa pela visão geral.
    indiceVisaoAtual = 0;
    reiniciarContagemVisaoAtual();
    renderizarVisao();

    if (temporizadorAtualizacao) {
        clearInterval(temporizadorAtualizacao);
    }

    temporizadorAtualizacao = setInterval(
        carregarDados,
        TEMPO_ATUALIZACAO_DADOS
    );

    const ciclo = new Promise(resolve => {
        resolverCiclo = resolve;
    });

    iniciarRotacao();

    return ciclo;

}


export function avancarSubvisao() {

    if (!cicloAtivo) return;

    avancarVisao();

}


export function voltarSubvisao() {

    if (
        !cicloAtivo ||
        indiceVisaoAtual <= 0
    ) {
        return;
    }

    indiceVisaoAtual--;
    reiniciarContagemVisaoAtual();

    trocarVisaoComTransicao();
    atualizarContador();

}


export function alternarPausa() {

    if (!cicloAtivo) return;

    pausado = !pausado;
    atualizarContador();

}


export function destruir() {

    cicloAtivo = false;
    pausado = false;
    pararRotacao();

    if (temporizadorAtualizacao) {
        clearInterval(temporizadorAtualizacao);
        temporizadorAtualizacao = null;
    }

    resolverCiclo = null;

}
