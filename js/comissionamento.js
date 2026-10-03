/* ================================================================
   COMISSIONAMENTO DE OBRAS — COM-V1
   Gráficos financeiros por status de análise e faturamento
   ================================================================ */

const URL_DADOS = "./dados/base_comissionamento.json";
const TEMPO_VISAO = 15;
const CORES = {
    coms: "#1959b5",
    comsClara: "#4d84d8",
    pend: "#f2aa3f",
    conc: "#6f91b9",
    faturado: "#17345f",
    texto: "#5e6a74",
    grade: "rgba(92, 111, 128, 0.13)"
};

const ULTIMOS_MESES_RESUMO = 2;
const ULTIMOS_MESES_PARCEIRAS = 6;
const FONTE_PADRAO_GRAFICO = 11;
const FONTE_LABEL_GRAFICO = 11;

let dadosGlobais = [];
let graficos = [];
let temporizadorRotacao = null;
let resolverCiclo = null;
let segundosRestantes = TEMPO_VISAO;
let cicloAtivo = false;
let pausado = false;

let pluginDataLabelsDisponivel = false;


/* ================================================================
   REGISTRO DE PLUGINS CHART.JS
   ================================================================ */

if (typeof Chart !== "undefined" && typeof ChartDataLabels !== "undefined") {
    try {
        Chart.register(ChartDataLabels);
        pluginDataLabelsDisponivel = true;
    } catch (erro) {
        console.warn("Falha ao registrar ChartDataLabels em COM-V1:", erro);
    }
}


/* ================================================================
   NORMALIZAÇÃO E AGREGAÇÕES
   ================================================================ */

function numero(valor) {
    if (valor === null || valor === undefined || valor === "") {
        return 0;
    }

    if (typeof valor === "number") {
        return Number.isFinite(valor) ? valor : 0;
    }

    const texto = String(valor).trim();
    if (!texto) return 0;

    const normalizado = texto.includes(",")
        ? texto.replace(/\./g, "").replace(",", ".")
        : texto;

    const resultado = Number(normalizado);
    return Number.isFinite(resultado) ? resultado : 0;
}

function normalizarRegistro(registro) {
    return {
        mesOrdem: numero(registro?.MES_ORDEM),
        mes: String(registro?.MES || "").trim().toLowerCase(),
        parceira: String(registro?.PARCEIRA || "").trim(),
        conc: numero(registro?.CONC),
        pend: numero(registro?.PEND),
        coms: numero(registro?.COMS),
        faturado: numero(registro?.["Faturado Comissionamento"]),
        qtdNotas: numero(registro?.QTD_NOTAS)
    };
}

function ordenarDados(dados) {
    return [...dados].sort((a, b) => {
        if (a.mesOrdem !== b.mesOrdem) {
            return a.mesOrdem - b.mesOrdem;
        }
        return a.parceira.localeCompare(b.parceira, "pt-BR");
    });
}

function obterMeses() {
    const mapa = new Map();

    for (const item of dadosGlobais) {
        if (!item.mes || !item.mesOrdem) continue;
        if (!mapa.has(item.mesOrdem)) {
            mapa.set(item.mesOrdem, item.mes);
        }
    }

    return [...mapa.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([ordem, mes]) => ({ ordem, mes }));
}

function obterParceiras() {
    return [...new Set(
        dadosGlobais
            .map(item => item.parceira)
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function somar(registros, campo) {
    return registros.reduce((total, item) => total + numero(item[campo]), 0);
}

function consolidarMes(ordem) {
    const registros = dadosGlobais.filter(item => item.mesOrdem === ordem);

    return {
        coms: somar(registros, "coms"),
        pend: somar(registros, "pend"),
        conc: somar(registros, "conc"),
        faturado: somar(registros, "faturado")
    };
}

function consolidarMesParceira(ordem, parceira) {
    const registros = dadosGlobais.filter(
        item => item.mesOrdem === ordem && item.parceira === parceira
    );

    return {
        coms: somar(registros, "coms"),
        pend: somar(registros, "pend"),
        conc: somar(registros, "conc"),
        faturado: somar(registros, "faturado")
    };
}

function formatarMes(mes) {
    if (!mes) return "--";
    return mes.charAt(0).toUpperCase() + mes.slice(1);
}

function formatarValorFinanceiro(valor) {
    const numeroValor = numero(valor);
    const absoluto = Math.abs(numeroValor);

    if (absoluto >= 1000000) {
        const milhoes = numeroValor / 1000000;
        const casas = Math.abs(milhoes) < 10 && !Number.isInteger(milhoes) ? 1 : 0;
        return `R$ ${milhoes.toLocaleString("pt-BR", {
            minimumFractionDigits: casas,
            maximumFractionDigits: casas
        })} mi`;
    }

    if (absoluto >= 1000) {
        return `R$ ${(numeroValor / 1000).toLocaleString("pt-BR", {
            maximumFractionDigits: 0
        })} mil`;
    }

    return `R$ ${numeroValor.toLocaleString("pt-BR", {
        maximumFractionDigits: 0
    })}`;
}

function formatarValorSomenteSePositivo(valor) {
    return numero(valor) > 0 ? formatarValorFinanceiro(valor) : "";
}


/* ================================================================
   CHART.JS
   ================================================================ */

const pluginRotuloMesAgrupado = {
    id: "rotuloMesAgrupado",
    afterDraw(chart, _args, pluginOptions) {
        const opcoes = pluginOptions || {};
        if (!opcoes.display) return;

        const escalaX = chart.scales?.x;
        if (!escalaX || !Array.isArray(opcoes.grupos) || opcoes.grupos.length === 0) {
            return;
        }

        const ctx = chart.ctx;
        const y = escalaX.bottom + (opcoes.offsetY ?? 18);
        const cor = opcoes.color || CORES.texto;
        const peso = opcoes.fontWeight || "700";
        const tamanho = opcoes.fontSize || FONTE_PADRAO_GRAFICO;
        const familia = opcoes.fontFamily || '"Segoe UI", Arial, Helvetica, sans-serif';

        ctx.save();
        ctx.fillStyle = cor;
        ctx.font = `${peso} ${tamanho}px ${familia}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for (const grupo of opcoes.grupos) {
            const indiceInicio = numero(grupo?.inicio);
            const indiceFim = numero(grupo?.fim);
            const rotulo = String(grupo?.rotulo || "").trim();

            if (!rotulo) continue;

            const xInicio = escalaX.getPixelForTick(indiceInicio);
            const xFim = escalaX.getPixelForTick(indiceFim);
            const xCentro = (xInicio + xFim) / 2;

            ctx.fillText(rotulo, xCentro, y);
        }

        ctx.restore();
    }
};

function destruirGraficos() {
    for (const grafico of graficos) {
        try {
            grafico?.destroy();
        } catch (erro) {
            console.warn("Falha ao destruir gráfico de comissionamento:", erro);
        }
    }
    graficos = [];
}

function criarGradienteBarra(contexto) {
    const chart = contexto.chart;
    const { ctx, chartArea } = chart;

    if (!chartArea) {
        return CORES.coms;
    }

    const gradiente = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    gradiente.addColorStop(0, CORES.coms);
    gradiente.addColorStop(1, CORES.comsClara);
    return gradiente;
}

function criarDatasets(valores, pontoRaio = 4) {
    return [
        {
            type: "bar",
            label: "COMS",
            data: valores.map(item => item.coms),
            backgroundColor: criarGradienteBarra,
            borderColor: CORES.coms,
            borderWidth: 0,
            borderRadius: 4,
            borderSkipped: false,
            order: 1,
            datalabels: {
                display: pluginDataLabelsDisponivel,
                color: CORES.coms,
                anchor: "end",
                align: "end",
                offset: 4,
                clamp: true,
                clip: false,
                formatter: formatarValorSomenteSePositivo,
                font: {
                    size: FONTE_LABEL_GRAFICO,
                    weight: "700"
                }
            }
        },
        {
            type: "line",
            label: "Faturado",
            data: valores.map(item => item.faturado),
            borderColor: CORES.faturado,
            backgroundColor: CORES.faturado,
            borderWidth: 3,
            pointRadius: pontoRaio,
            pointHoverRadius: pontoRaio,
            pointBackgroundColor: CORES.faturado,
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            tension: 0.16,
            fill: false,
            order: 0,
            datalabels: {
                display: pluginDataLabelsDisponivel,
                color: CORES.faturado,
                anchor: "end",
                align: "top",
                offset: 4,
                clamp: true,
                formatter: formatarValorSomenteSePositivo,
                font: {
                    size: FONTE_LABEL_GRAFICO,
                    weight: "700"
                }
            }
        }
    ];
}

function opcoesGrafico({
    tamanhoX = FONTE_PADRAO_GRAFICO,
    rotacaoX = 0,
    paddingBottom = 0,
    grupoMeses = null
} = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 450
        },
        interaction: {
            intersect: false,
            mode: "index"
        },
        layout: {
            padding: {
                top: 20,
                right: 12,
                bottom: paddingBottom,
                left: 0
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: false
            },
            datalabels: {
                display: pluginDataLabelsDisponivel
            },
            rotuloMesAgrupado: grupoMeses
                ? {
                    display: true,
                    grupos: grupoMeses,
                    offsetY: 18,
                    color: CORES.texto,
                    fontSize: FONTE_PADRAO_GRAFICO,
                    fontWeight: "700"
                }
                : {
                    display: false
                }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                border: {
                    color: "rgba(85, 104, 121, 0.18)"
                },
                ticks: {
                    color: CORES.texto,
                    padding: grupoMeses ? 4 : 6,
                    font: {
                        size: tamanhoX,
                        weight: "600"
                    },
                    maxRotation: rotacaoX,
                    minRotation: rotacaoX,
                    autoSkip: false
                }
            },
            y: {
                beginAtZero: true,
                grace: "18%",
                display: false,
                grid: {
                    display: false
                },
                border: {
                    display: false
                },
                ticks: {
                    display: false
                }
            }
        }
    };
}

function criarGrafico(canvasId, labels, valores, opcoes = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return null;

    const grafico = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: criarDatasets(valores, opcoes.pontoRaio || 4)
        },
        options: opcoesGrafico(opcoes),
        plugins: [pluginRotuloMesAgrupado]
    });

    graficos.push(grafico);
    return grafico;
}

function renderizarGraficos() {
    destruirGraficos();

    if (typeof Chart === "undefined") {
        console.error("Chart.js não está disponível para COM-V1.");
        return;
    }

    const meses = obterMeses();
    const parceiras = obterParceiras();
    const ultimosMeses = meses.slice(-ULTIMOS_MESES_RESUMO);
    const ultimosMesesParceiras = meses.slice(-ULTIMOS_MESES_PARCEIRAS);

    const valoresResumo = ultimosMeses.map(item => consolidarMes(item.ordem));
    criarGrafico(
        "graficoResumo",
        ultimosMeses.map(item => formatarMes(item.mes)),
        valoresResumo,
        { tamanhoX: FONTE_PADRAO_GRAFICO, pontoRaio: 5 }
    );

    const labelsParceiras = [];
    const valoresParceiras = [];
    const gruposMesesParceiras = [];

    ultimosMeses.forEach((mes) => {
        const indiceInicio = labelsParceiras.length;

        for (const parceira of parceiras) {
            labelsParceiras.push(parceira);
            valoresParceiras.push(consolidarMesParceira(mes.ordem, parceira));
        }

        gruposMesesParceiras.push({
            inicio: indiceInicio,
            fim: labelsParceiras.length - 1,
            rotulo: formatarMes(mes.mes)
        });
    });

    criarGrafico(
        "graficoParceiras",
        labelsParceiras,
        valoresParceiras,
        {
            tamanhoX: FONTE_PADRAO_GRAFICO,
            pontoRaio: 4,
            grupoMeses: gruposMesesParceiras,
            paddingBottom: 18
        }
    );

    const slots = [
        ["tituloParceira1", "graficoParceira1"],
        ["tituloParceira2", "graficoParceira2"],
        ["tituloParceira3", "graficoParceira3"]
    ];

    slots.forEach(([tituloId, canvasId], indice) => {
        const parceira = parceiras[indice];
        const titulo = document.getElementById(tituloId);

        if (!parceira) {
            if (titulo) titulo.textContent = "Sem parceira — últimos 6 meses";
            return;
        }

        if (titulo) {
            titulo.textContent = `${parceira} — últimos 6 meses`;
        }

        const valores = ultimosMesesParceiras.map(item =>
            consolidarMesParceira(item.ordem, parceira)
        );

        criarGrafico(
            canvasId,
            ultimosMesesParceiras.map(item => formatarMes(item.mes)),
            valores,
            { tamanhoX: FONTE_PADRAO_GRAFICO, pontoRaio: 3.5 }
        );
    });
}


/* ================================================================
   TEXTOS E ESTADO DA VISÃO
   ================================================================ */

function atualizarTextos() {
    const meses = obterMeses();
    const ultimosMeses = meses.slice(-ULTIMOS_MESES_RESUMO);
    const ultimosMesesParceiras = meses.slice(-ULTIMOS_MESES_PARCEIRAS);

    window.PAINEL_BASE?.definirCabecalho({
        titulo: "Obras Comissionadas",
        subtitulo: "Volume financeiro por status de análise",
        contexto: "COMISSIONAMENTO"
    });

    const periodo = document.getElementById("periodoDados");
    if (periodo && meses.length > 0) {
        periodo.textContent =
            `Período: ${formatarMes(meses[0].mes)}–${formatarMes(meses[meses.length - 1].mes)}`;
    }

    const resumo = document.getElementById("subtituloResumo");
    if (resumo && ultimosMeses.length > 0) {
        resumo.textContent =
            `COMS x Faturado • ${ultimosMeses.map(item => formatarMes(item.mes)).join(" e ")}`;
    }

    const parceiras = document.getElementById("subtituloParceiras");
    if (parceiras && ultimosMeses.length > 0) {
        parceiras.textContent =
            `Parceiras • ${ultimosMeses.map(item => formatarMes(item.mes)).join(" e ")}`;
    }

    const subtitulosHistorico = document.querySelectorAll(".comissionamento-subtitulo-historico");
    const textoHistorico = ultimosMesesParceiras.length > 0
        ? `COMS x Faturado • ${formatarMes(ultimosMesesParceiras[0].mes)}–${formatarMes(ultimosMesesParceiras[ultimosMesesParceiras.length - 1].mes)}`
        : "COMS x Faturado • Últimos 6 meses";

    subtitulosHistorico.forEach(item => {
        item.textContent = textoHistorico;
    });
}

function renderizarVisao() {
    if (dadosGlobais.length === 0) return;

    atualizarTextos();

    try {
        renderizarGraficos();
    } catch (erro) {
        console.error("Erro ao renderizar os gráficos de COM-V1:", erro);
    }

    atualizarContador();
}


/* ================================================================
   DADOS
   ================================================================ */

async function carregarDados() {
    const erro = document.getElementById("erro");

    try {
        const resposta = await fetch(
            `${URL_DADOS}?t=${Date.now()}`,
            { cache: "no-store" }
        );

        if (!resposta.ok) {
            throw new Error(`Erro HTTP ${resposta.status}`);
        }

        const json = await resposta.json();
        const lista = Array.isArray(json)
            ? json
            : (Array.isArray(json?.dados) ? json.dados : null);

        if (!Array.isArray(lista)) {
            throw new Error("base_comissionamento.json deve conter uma lista de registros.");
        }

        const normalizados = ordenarDados(
            lista
                .map(normalizarRegistro)
                .filter(item => item.mesOrdem > 0 && item.mes && item.parceira)
        );

        if (normalizados.length === 0) {
            throw new Error("Nenhum registro válido de comissionamento foi encontrado.");
        }

        dadosGlobais = normalizados;
        renderizarVisao();

        if (erro) {
            erro.style.display = "none";
            erro.textContent = "";
        }

        const status = document.getElementById("statusAtualizacao");
        if (status) {
            status.textContent =
                "Última atualização: " +
                new Date().toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                });
        }
    } catch (falha) {
        console.error("Erro ao carregar dados de comissionamento:", falha);

        if (erro) {
            erro.style.display = "block";
            erro.textContent =
                "Não foi possível carregar os dados de comissionamento.";
        }

        if (dadosGlobais.length > 0) {
            renderizarVisao();
        }
    }
}


/* ================================================================
   CICLO DA VISÃO
   ================================================================ */

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

function atualizarContador() {
    const contador = document.getElementById("contador");
    const barra = document.getElementById("barraTempo");

    if (!contador || !barra) return;

    contador.textContent = `${segundosRestantes}s`;

    const percentual = Math.max(
        0,
        (segundosRestantes / TEMPO_VISAO) * 100
    );

    barra.style.width = `${percentual}%`;
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
            concluirCiclo();
        }

        atualizarContador();
    }, 1000);
}


/* ================================================================
   CICLO DE VIDA DO MÓDULO — PG-V2
   ================================================================ */

export async function iniciar() {
    segundosRestantes = TEMPO_VISAO;
    cicloAtivo = true;
    pausado = false;

    await carregarDados();

    const ciclo = new Promise(resolve => {
        resolverCiclo = resolve;
    });

    iniciarRotacao();
    return ciclo;
}

export function avancarSubvisao() {
    if (!cicloAtivo) return;
    concluirCiclo();
}

export function voltarSubvisao() {
    if (!cicloAtivo) return;
    segundosRestantes = TEMPO_VISAO;
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

    destruirGraficos();
    resolverCiclo = null;
}
