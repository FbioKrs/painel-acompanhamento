/* ================================================================
   DIA C — DC-V1 / PG-V2
   ================================================================ */

const TEMPO_VISAO = 15;

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


const TIPOGRAFIA_GRAFICOS =
    window.PAINEL_CONFIG
        ?.tipografia
        ?.grafico
    || {};

const FONTE_MINIMA_TV =
    Number(
        window.PAINEL_CONFIG
            ?.tipografia
            ?.textoMinimo
    )
    || 22;

const FONTE_GRAFICO_EIXO = Math.max(
    FONTE_MINIMA_TV,
    Number(TIPOGRAFIA_GRAFICOS.eixo) || FONTE_MINIMA_TV
);

const FONTE_GRAFICO_LEGENDA = Math.max(
    FONTE_MINIMA_TV,
    Number(TIPOGRAFIA_GRAFICOS.legenda) || FONTE_MINIMA_TV
);

const FONTE_GRAFICO_VALOR = Math.max(
    FONTE_MINIMA_TV,
    Number(TIPOGRAFIA_GRAFICOS.valor) || FONTE_MINIMA_TV
);


const estilosRaiz =
    getComputedStyle(
        document.documentElement
    );


function corCss(
    nomeVariavel,
    fallback
) {

    const valor =
        estilosRaiz
            .getPropertyValue(
                nomeVariavel
            )
            .trim();


    return valor || fallback;

}


const COR_EQUIPES =
    corCss(
        "--equipes",
        "#1f4e79"
    );

const COR_EQUIPES_CLARO =
    corCss(
        "--equipes-claro",
        "#4d7297"
    );

const COR_PROGRAMACOES =
    corCss(
        "--programacoes",
        "#9a4e00"
    );

const COR_PROGRAMACOES_CLARO =
    corCss(
        "--programacoes-claro",
        "#c8761e"
    );

const COR_LIGACOES =
    corCss(
        "--ligacoes",
        "#2e6a4f"
    );

const COR_LIGACOES_CLARO =
    corCss(
        "--ligacoes-claro",
        "#4b8469"
    );


function criarGradienteBarra(
    context,
    corInicial,
    corFinal,
    horizontal = false
) {

    const chart =
        context.chart;


    const area =
        chart.chartArea;


    if (!area) {
        return corInicial;
    }


    const gradiente =
        horizontal
        ?
        chart.ctx.createLinearGradient(
            area.left,
            0,
            area.right,
            0
        )
        :
        chart.ctx.createLinearGradient(
            0,
            area.bottom,
            0,
            area.top
        );


    gradiente.addColorStop(
        0,
        corInicial
    );


    gradiente.addColorStop(
        1,
        corFinal
    );


    return gradiente;

}


let dadosGlobais = [];


let visoes = [

    {
        tipo: "geral",
        nome: "VISÃO GERAL"
    }

];


let indiceVisaoAtual = 0;

let segundosRestantes =
    TEMPO_VISAO;

let temporizadorRotacao =
    null;

let temporizadorAtualizacao = null;
let resolverCiclo = null;
let cicloAtivo = false;
let pausado = false;


let graficoEvolucao =
    null;

let graficoParceira =
    null;


let pluginDataLabelsDisponivel =
    false;



/* ================================================================
   CHART.JS
   ================================================================ */

if (
    typeof Chart !==
    "undefined"
) {

    if (
        typeof ChartDataLabels !==
        "undefined"
    ) {

        try {

            Chart.register(
                ChartDataLabels
            );

            pluginDataLabelsDisponivel =
                true;

        }
        catch (erro) {

            console.warn(
                "Falha ao registrar ChartDataLabels:",
                erro
            );

        }

    }

}
else {

    console.warn(
        "Chart.js não foi carregado."
    );

}



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



function formatarNumero(valor) {

    return numero(valor)
        .toLocaleString(
            "pt-BR",
            {
                maximumFractionDigits: 2
            }
        );

}



function converterData(valor) {

    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {
        return null;
    }


    if (
        typeof valor === "number"
        &&
        valor > 20000
    ) {

        const data =
            new Date(

                Date.UTC(
                    1899,
                    11,
                    30
                )
                +
                valor *
                86400000

            );


        if (
            !isNaN(
                data.getTime()
            )
        ) {

            return data;

        }

    }


    const texto =
        String(valor)
            .trim();


    if (
        /^\d+(\.\d+)?$/
            .test(texto)
    ) {

        const serial =
            Number(texto);


        if (
            serial > 20000
        ) {

            const data =
                new Date(

                    Date.UTC(
                        1899,
                        11,
                        30
                    )
                    +
                    serial *
                    86400000

                );


            if (
                !isNaN(
                    data.getTime()
                )
            ) {

                return data;

            }

        }

    }


    let correspondencia =
        texto.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
        );


    if (correspondencia) {

        return new Date(

            Date.UTC(

                Number(
                    correspondencia[3]
                ),

                Number(
                    correspondencia[2]
                ) - 1,

                Number(
                    correspondencia[1]
                )

            )

        );

    }


    correspondencia =
        texto.match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})/
        );


    if (correspondencia) {

        return new Date(

            Date.UTC(

                Number(
                    correspondencia[1]
                ),

                Number(
                    correspondencia[2]
                ) - 1,

                Number(
                    correspondencia[3]
                )

            )

        );

    }


    const data =
        new Date(texto);


    if (
        !isNaN(
            data.getTime()
        )
    ) {

        return data;

    }


    return null;

}



function formatarData(valor) {

    const data =
        converterData(valor);


    if (!data) {

        return String(
            valor ?? ""
        );

    }


    const meses = [

        "jan",
        "fev",
        "mar",
        "abr",
        "mai",
        "jun",
        "jul",
        "ago",
        "set",
        "out",
        "nov",
        "dez"

    ];


    const dia =
        String(
            data.getUTCDate()
        )
        .padStart(
            2,
            "0"
        );


    const mes =
        meses[
            data.getUTCMonth()
        ];


    const ano =
        data.getUTCFullYear();


    return `${dia}/${mes}/${ano}`;

}



function ordenarPorData(dados) {

    return [...dados]
        .sort(
            (
                a,
                b
            ) => {

                const dataA =
                    converterData(
                        a.DATA
                    );

                const dataB =
                    converterData(
                        b.DATA
                    );


                if (
                    !dataA &&
                    !dataB
                ) {
                    return 0;
                }


                if (!dataA) {
                    return 1;
                }


                if (!dataB) {
                    return -1;
                }


                return (
                    dataA.getTime()
                    -
                    dataB.getTime()
                );

            }
        );

}



function nomeParceira(registro) {

    const nome =
        registro?.PARCEIRA;


    if (
        nome === null ||
        nome === undefined
    ) {

        return "";

    }


    return String(nome)
        .trim();

}



function somarCampo(
    dados,
    campo
) {

    return dados.reduce(

        (
            total,
            item
        ) =>

            total
            +
            numero(
                item[campo]
            ),

        0

    );

}



/* ================================================================
   VISÕES
   ================================================================ */

function atualizarListaVisoes() {

    const nomeAtual =
        visoes[
            indiceVisaoAtual
        ]?.nome;


    const parceiras = [

        ...new Set(

            dadosGlobais

                .map(
                    item =>
                        nomeParceira(item)
                )

                .filter(Boolean)

        )

    ]
    .sort(
        (
            a,
            b
        ) =>
            a.localeCompare(
                b,
                "pt-BR",
                {
                    sensitivity: "base"
                }
            )
    );


    visoes = [

        {
            tipo: "geral",
            nome: "VISÃO GERAL"
        },

        ...parceiras.map(

            parceira => ({

                tipo: "parceira",

                nome: parceira,

                parceira: parceira

            })

        )

    ];


    const novoIndice =
        visoes.findIndex(

            visao =>
                visao.nome ===
                nomeAtual

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



function obterDadosVisaoAtual() {

    const visao =
        obterVisaoAtual();


    if (
        visao.tipo ===
        "geral"
    ) {

        return dadosGlobais;

    }


    return dadosGlobais
        .filter(

            item =>
                nomeParceira(item)
                ===
                visao.parceira

        );

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
    segundosRestantes = TEMPO_VISAO;
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
    segundosRestantes = TEMPO_VISAO;
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
        (segundosRestantes / TEMPO_VISAO) * 100
    );

    barra.style.width = percentual + "%";

}



/* ================================================================
   KPIs
   ================================================================ */

function renderizarCards(dados) {

    document.getElementById(
        "totalEquipes"
    ).textContent =

        formatarNumero(

            somarCampo(
                dados,
                "EQUIPES_MOBILIZADAS"
            )

        );


    document.getElementById(
        "totalProgramacoes"
    ).textContent =

        formatarNumero(

            somarCampo(
                dados,
                "PROGRAMACOES_EXECUTADAS"
            )

        );


    document.getElementById(
        "totalLigacoes"
    ).textContent =

        formatarNumero(

            somarCampo(
                dados,
                "LIGACOES_EXECUTADAS"
            )

        );


    const complemento =
        `${dados.length} registro${dados.length === 1 ? "" : "s"} considerado${dados.length === 1 ? "" : "s"}`;


    document.getElementById(
        "descricaoEquipes"
    ).textContent =
        complemento;


    document.getElementById(
        "descricaoProgramacoes"
    ).textContent =
        complemento;


    document.getElementById(
        "descricaoLigacoes"
    ).textContent =
        complemento;

}



/* ================================================================
   AGRUPAMENTO POR DATA
   ================================================================ */

function agruparPorData(dados) {

    const mapa =
        new Map();


    ordenarPorData(
        dados
    )
    .forEach(
        item => {

            const data =
                converterData(
                    item.DATA
                );


            if (!data) {
                return;
            }


            const chave =
                data.getTime();


            if (
                !mapa.has(chave)
            ) {

                mapa.set(
                    chave,
                    {

                        DATA:
                            item.DATA,

                        EQUIPES_MOBILIZADAS:
                            0,

                        PROGRAMACOES_EXECUTADAS:
                            0,

                        LIGACOES_EXECUTADAS:
                            0

                    }
                );

            }


            const registro =
                mapa.get(chave);


            registro
                .EQUIPES_MOBILIZADAS
                +=
                numero(
                    item.EQUIPES_MOBILIZADAS
                );


            registro
                .PROGRAMACOES_EXECUTADAS
                +=
                numero(
                    item.PROGRAMACOES_EXECUTADAS
                );


            registro
                .LIGACOES_EXECUTADAS
                +=
                numero(
                    item.LIGACOES_EXECUTADAS
                );

        }
    );


    return [

        ...mapa.entries()

    ]
    .sort(
        (
            a,
            b
        ) =>
            a[0] - b[0]
    )
    .map(
        item =>
            item[1]
    );

}



/* ================================================================
   GRÁFICO DE EVOLUÇÃO
   ================================================================ */

function renderizarGraficoEvolucao(
    dados
) {

    if (
        typeof Chart ===
        "undefined"
    ) {

        return;

    }


    if (
        graficoEvolucao
    ) {

        graficoEvolucao.destroy();

        graficoEvolucao =
            null;

    }


    const dadosAgrupados =
        agruparPorData(
            dados
        );


    graficoEvolucao =
        new Chart(

            document.getElementById(
                "graficoEvolucao"
            ),

            {

                type: "bar",


                data: {

                    labels:

                        dadosAgrupados.map(

                            item =>
                                formatarData(
                                    item.DATA
                                )

                        ),


                    datasets: [

                        {

                            label:
                                "Equipes Mobilizadas",

                            data:

                                dadosAgrupados.map(

                                    item =>
                                        numero(
                                            item.EQUIPES_MOBILIZADAS
                                        )

                                ),

                            backgroundColor:
                                context =>
                                    criarGradienteBarra(
                                        context,
                                        COR_EQUIPES,
                                        COR_EQUIPES_CLARO
                                    ),

                            borderRadius:
                                6,

                            maxBarThickness:
                                48

                        },


                        {

                            label:
                                "Programações Executadas",

                            data:

                                dadosAgrupados.map(

                                    item =>
                                        numero(
                                            item.PROGRAMACOES_EXECUTADAS
                                        )

                                ),

                            backgroundColor:
                                context =>
                                    criarGradienteBarra(
                                        context,
                                        COR_PROGRAMACOES,
                                        COR_PROGRAMACOES_CLARO
                                    ),

                            borderRadius:
                                6,

                            maxBarThickness:
                                48

                        },


                        {

                            label:
                                "Ligações Executadas",

                            data:

                                dadosAgrupados.map(

                                    item =>
                                        numero(
                                            item.LIGACOES_EXECUTADAS
                                        )

                                ),

                            backgroundColor:
                                context =>
                                    criarGradienteBarra(
                                        context,
                                        COR_LIGACOES,
                                        COR_LIGACOES_CLARO
                                    ),

                            borderRadius:
                                6,

                            maxBarThickness:
                                48

                        }

                    ]

                },


                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    animation: {

                        duration:
                            500

                    },

                    interaction: {

                        mode:
                            "index",

                        intersect:
                            false

                    },

                    layout: {

                        padding: {

                            top:
                                28

                        }

                    },


                    plugins: {

                        legend: {

                            position:
                                "bottom",

                            labels: {

                                usePointStyle:
                                    true,

                                pointStyle:
                                    "circle",

                                boxWidth:
                                    10,

                                boxHeight:
                                    10,

                                padding:
                                    24,

                                font: {

                                    size:
                                        FONTE_GRAFICO_LEGENDA

                                }

                            }

                        },


                        tooltip: {

                            enabled:
                                true

                        },


                        datalabels: {

                            display:
                                pluginDataLabelsDisponivel,

                            anchor:
                                "end",

                            align:
                                "end",

                            offset:
                                3,

                            color:
                                "#58656f",

                            font: {

                                size:
                                    FONTE_GRAFICO_VALOR,

                                weight:
                                    "600"

                            },

                            formatter:

                                function(valor) {

                                    return (
                                        valor === 0
                                            ?
                                            ""
                                            :
                                            formatarNumero(valor)
                                    );

                                }

                        }

                    },


                    scales: {

                        x: {

                            grid: {

                                display:
                                    false

                            },

                            border: {

                                display:
                                    false

                            },

                            ticks: {

                                color:
                                    "#65727c",

                                font: {

                                    size:
                                        FONTE_GRAFICO_EIXO

                                },

                                maxRotation:
                                    0,

                                autoSkip:
                                    true

                            }

                        },


                        y: {

                            beginAtZero:
                                true,

                            grid: {

                                color:
                                    "rgba(110,125,138,0.10)"

                            },

                            border: {

                                display:
                                    false

                            },

                            ticks: {

                                precision:
                                    0,

                                color:
                                    "#75818a",

                                font: {

                                    size:
                                        FONTE_GRAFICO_EIXO

                                }

                            }

                        }

                    }

                }

            }

        );

}



/* ================================================================
   GRÁFICO GERAL POR PARCEIRA
   ================================================================ */

function renderizarGraficoGeralParceiras() {

    if (
        typeof Chart ===
        "undefined"
    ) {

        return;

    }


    if (
        graficoParceira
    ) {

        graficoParceira.destroy();

        graficoParceira =
            null;

    }


    const mapa =
        new Map();


    dadosGlobais
        .forEach(
            item => {

                const parceira =
                    nomeParceira(item);


                if (!parceira) {
                    return;
                }


                if (
                    !mapa.has(parceira)
                ) {

                    mapa.set(
                        parceira,
                        {

                            equipes: 0,

                            programacoes: 0,

                            ligacoes: 0

                        }
                    );

                }


                const acumulado =
                    mapa.get(parceira);


                acumulado.equipes +=

                    numero(
                        item.EQUIPES_MOBILIZADAS
                    );


                acumulado.programacoes +=

                    numero(
                        item.PROGRAMACOES_EXECUTADAS
                    );


                acumulado.ligacoes +=

                    numero(
                        item.LIGACOES_EXECUTADAS
                    );

            }
        );


    const registros = [

        ...mapa.entries()

    ]
    .sort(
        (
            a,
            b
        ) =>
            a[0].localeCompare(
                b[0],
                "pt-BR",
                {
                    sensitivity: "base"
                }
            )
    );


    graficoParceira =
        new Chart(

            document.getElementById(
                "graficoParceira"
            ),

            {

                type: "bar",


                data: {

                    labels:

                        registros.map(
                            item =>
                                item[0]
                        ),


                    datasets: [

                        {

                            label:
                                "Equipes",

                            data:

                                registros.map(
                                    item =>
                                        item[1].equipes
                                ),

                            backgroundColor:
                                context =>
                                    criarGradienteBarra(
                                        context,
                                        COR_EQUIPES,
                                        COR_EQUIPES_CLARO,
                                        true
                                    ),

                            borderRadius:
                                6

                        },


                        {

                            label:
                                "Programações",

                            data:

                                registros.map(
                                    item =>
                                        item[1].programacoes
                                ),

                            backgroundColor:
                                context =>
                                    criarGradienteBarra(
                                        context,
                                        COR_PROGRAMACOES,
                                        COR_PROGRAMACOES_CLARO,
                                        true
                                    ),

                            borderRadius:
                                6

                        },


                        {

                            label:
                                "Ligações",

                            data:

                                registros.map(
                                    item =>
                                        item[1].ligacoes
                                ),

                            backgroundColor:
                                context =>
                                    criarGradienteBarra(
                                        context,
                                        COR_LIGACOES,
                                        COR_LIGACOES_CLARO,
                                        true
                                    ),

                            borderRadius:
                                6

                        }

                    ]

                },


                options: {

                    indexAxis:
                        "y",

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    animation: {

                        duration:
                            500

                    },

                    layout: {

                        padding: {

                            right:
                                55

                        }

                    },


                    plugins: {

                        legend: {

                            position:
                                "bottom",

                            labels: {

                                usePointStyle:
                                    true,

                                pointStyle:
                                    "circle",

                                boxWidth:
                                    10,

                                padding:
                                    18,

                                font: {

                                    size:
                                        FONTE_GRAFICO_LEGENDA

                                }

                            }

                        },


                        datalabels: {

                            display:
                                pluginDataLabelsDisponivel,

                            anchor:
                                "end",

                            align:
                                "right",

                            color:
                                "#59656e",

                            font: {

                                size:
                                    FONTE_GRAFICO_VALOR,

                                weight:
                                    "600"

                            },

                            formatter:

                                function(valor) {

                                    return (
                                        valor === 0
                                            ?
                                            ""
                                            :
                                            formatarNumero(valor)
                                    );

                                }

                        }

                    },


                    scales: {

                        x: {

                            beginAtZero:
                                true,

                            grid: {

                                color:
                                    "rgba(110,125,138,0.10)"

                            },

                            border: {

                                display:
                                    false

                            },

                            ticks: {

                                precision:
                                    0,

                                font: {

                                    size:
                                        FONTE_GRAFICO_EIXO

                                }

                            }

                        },


                        y: {

                            grid: {

                                display:
                                    false

                            },

                            border: {

                                display:
                                    false

                            },

                            ticks: {

                                font: {

                                    size:
                                        FONTE_GRAFICO_EIXO

                                }

                            }

                        }

                    }

                }

            }

        );

}



/* ================================================================
   GRÁFICO INDIVIDUAL DA PARCEIRA
   ================================================================ */

function renderizarGraficoComposicaoParceira(
    dados
) {

    if (
        typeof Chart ===
        "undefined"
    ) {

        return;

    }


    if (
        graficoParceira
    ) {

        graficoParceira.destroy();

        graficoParceira =
            null;

    }


    const totalEquipes =
        somarCampo(
            dados,
            "EQUIPES_MOBILIZADAS"
        );


    const totalProgramacoes =
        somarCampo(
            dados,
            "PROGRAMACOES_EXECUTADAS"
        );


    const totalLigacoes =
        somarCampo(
            dados,
            "LIGACOES_EXECUTADAS"
        );


    graficoParceira =
        new Chart(

            document.getElementById(
                "graficoParceira"
            ),

            {

                type:
                    "bar",


                data: {

                    labels: [

                        "Equipes",

                        "Programações",

                        "Ligações"

                    ],


                    datasets: [

                        {

                            label:
                                "Total",

                            data: [

                                totalEquipes,

                                totalProgramacoes,

                                totalLigacoes

                            ],

                            backgroundColor:
                                context => {

                                    const paleta = [
                                        [
                                            COR_EQUIPES,
                                            COR_EQUIPES_CLARO
                                        ],
                                        [
                                            COR_PROGRAMACOES,
                                            COR_PROGRAMACOES_CLARO
                                        ],
                                        [
                                            COR_LIGACOES,
                                            COR_LIGACOES_CLARO
                                        ]
                                    ];


                                    const cores =
                                        paleta[
                                            context.dataIndex
                                        ]
                                        ||
                                        paleta[0];


                                    return criarGradienteBarra(
                                        context,
                                        cores[0],
                                        cores[1],
                                        true
                                    );

                                },

                            borderRadius:
                                8,

                            maxBarThickness:
                                78

                        }

                    ]

                },


                options: {

                    indexAxis:
                        "y",

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    animation: {

                        duration:
                            500

                    },

                    layout: {

                        padding: {

                            right:
                                60

                        }

                    },


                    plugins: {

                        legend: {

                            display:
                                false

                        },


                        datalabels: {

                            display:
                                pluginDataLabelsDisponivel,

                            anchor:
                                "end",

                            align:
                                "right",

                            color:
                                "#53606a",

                            font: {

                                size:
                                    FONTE_GRAFICO_VALOR,

                                weight:
                                    "700"

                            },

                            formatter:

                                function(valor) {

                                    return formatarNumero(
                                        valor
                                    );

                                }

                        }

                    },


                    scales: {

                        x: {

                            beginAtZero:
                                true,

                            grid: {

                                color:
                                    "rgba(110,125,138,0.10)"

                            },

                            border: {

                                display:
                                    false

                            },

                            ticks: {

                                precision:
                                    0,

                                font: {

                                    size:
                                        FONTE_GRAFICO_EIXO

                                }

                            }

                        },


                        y: {

                            grid: {

                                display:
                                    false

                            },

                            border: {

                                display:
                                    false

                            },

                            ticks: {

                                font: {

                                    size:
                                        FONTE_GRAFICO_EIXO

                                }

                            }

                        }

                    }

                }

            }

        );

}



/* ================================================================
   TEXTOS DA VISÃO
   ================================================================ */

function atualizarTextosVisao(
    dados
) {

    const visao =
        obterVisaoAtual();


    document.getElementById(
        "badgeRegistros"
    ).textContent =

        `${dados.length} registro${dados.length === 1 ? "" : "s"}`;


    if (
        visao.tipo ===
        "geral"
    ) {

        document.getElementById(
            "nomeVisaoHeader"
        ).textContent =
            "VISÃO GERAL";


        document.getElementById(
            "tituloVisao"
        ).textContent =
            "Visão Geral";


        document.getElementById(
            "descricaoVisao"
        ).textContent =
            "Consolidado de todas as parceiras";


        document.getElementById(
            "subtituloEvolucao"
        ).textContent =
            "Evolução cronológica consolidada";


        document.getElementById(
            "tituloGraficoSecundario"
        ).textContent =
            "Execuções por Parceira";


        document.getElementById(
            "subtituloGraficoSecundario"
        ).textContent =
            "Comparativo acumulado";

    }
    else {

        document.getElementById(
            "nomeVisaoHeader"
        ).textContent =
            visao.parceira.toUpperCase();


        document.getElementById(
            "tituloVisao"
        ).textContent =
            visao.parceira;


        document.getElementById(
            "descricaoVisao"
        ).textContent =
            "Desempenho individual da parceira";


        document.getElementById(
            "subtituloEvolucao"
        ).textContent =
            `Evolução cronológica • ${visao.parceira}`;


        document.getElementById(
            "tituloGraficoSecundario"
        ).textContent =
            "Composição dos Resultados";


        document.getElementById(
            "subtituloGraficoSecundario"
        ).textContent =
            `Totais acumulados • ${visao.parceira}`;

    }

}



/* ================================================================
   RENDERIZAÇÃO
   ================================================================ */

function renderizarVisao() {

    const dados =
        obterDadosVisaoAtual();


    atualizarTextosVisao(
        dados
    );


    renderizarCards(
        dados
    );


    if (
        typeof Chart !==
        "undefined"
    ) {

        try {

            renderizarGraficoEvolucao(
                dados
            );

        }
        catch (erro) {

            console.error(
                "Erro no gráfico de evolução:",
                erro
            );

        }


        try {

            const visao =
                obterVisaoAtual();


            if (
                visao.tipo ===
                "geral"
            ) {

                renderizarGraficoGeralParceiras();

            }
            else {

                renderizarGraficoComposicaoParceira(
                    dados
                );

            }

        }
        catch (erro) {

            console.error(
                "Erro no gráfico secundário:",
                erro
            );

        }

    }


    atualizarContador();

}



/* ================================================================
   CARREGAMENTO DO JSON
   ================================================================ */

async function carregarDados() {

    const erro =
        document.getElementById(
            "erro"
        );


    try {

        const resposta =
            await fetch(

                "./dados.json?t="
                +
                new Date().getTime()

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

            Array.isArray(json)

            ?

            json

            :

            (
                Array.isArray(
                    json?.dados
                )

                ?

                json.dados

                :

                null
            );


        if (
            !Array.isArray(dados)
        ) {

            throw new Error(
                "dados.json não contém uma lista válida."
            );

        }


        dadosGlobais =
            ordenarPorData(
                dados
            );


        atualizarListaVisoes();


        renderizarVisao();


        erro.style.display =
            "none";


        erro.textContent =
            "";


        document.getElementById(
            "statusAtualizacao"
        ).textContent =

            "Última atualização: "
            +
            new Date()
                .toLocaleTimeString(
                    "pt-BR",
                    {

                        hour:
                            "2-digit",

                        minute:
                            "2-digit",

                        second:
                            "2-digit"

                    }
                );

    }
    catch (falha) {

        console.error(
            "Erro ao carregar dados:",
            falha
        );


        erro.style.display =
            "block";


        erro.textContent =
            "Não foi possível atualizar os dados. A última informação carregada continuará sendo exibida.";


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
    segundosRestantes = TEMPO_VISAO;
    cicloAtivo = true;
    pausado = false;

    await carregarDados();

    // Garante que o ciclo sempre começa pela visão geral.
    indiceVisaoAtual = 0;
    segundosRestantes = TEMPO_VISAO;
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
    segundosRestantes = TEMPO_VISAO;

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

    if (graficoEvolucao) {
        graficoEvolucao.destroy();
        graficoEvolucao = null;
    }

    if (graficoParceira) {
        graficoParceira.destroy();
        graficoParceira = null;
    }

    resolverCiclo = null;

}
