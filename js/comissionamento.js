/* ================================================================
   COMISSIONAMENTO DE OBRAS — COM-V1
   Comparativo financeiro de COMS e Faturado
   ================================================================ */

const URL_DADOS = "./dados/base_comissionamento.json";
const TEMPO_SUBVISAO = 15;
const TOTAL_SUBVISOES = 2;
const ULTIMOS_MESES_RESUMO = 2;
const ULTIMOS_MESES_HISTORICO = 6;

const CORES = {
    azul: "#1959b5",
    azulMedio: "#3f8fe7",
    azulClaro: "#88bdf3",
    azulClaro2: "#b7d9f8",
    conc: "#9db4c9",
    pend: "#f1b24b",
    linha: "#17345f",
    texto: "#17345f",
    textoSecundario: "#64798a",
    verde: "#16a36a",
    verdeBg: "#e8f7f0",
    vermelho: "#e14343",
    vermelhoBg: "#ffeded",
    neutro: "#6b7a87",
    neutroBg: "#eef2f5"
};

const TIPOGRAFIA_GLOBAL_GRAFICOS = window.PAINEL_CONFIG?.tipografia?.grafico || {};
const TIPOGRAFIA_GRAFICOS = Object.freeze({
    rotuloEixo: Number(TIPOGRAFIA_GLOBAL_GRAFICOS.eixo) || 22,
    rotuloValor: Number(TIPOGRAFIA_GLOBAL_GRAFICOS.valor) || 22,
    pesoEixo: String(TIPOGRAFIA_GLOBAL_GRAFICOS.peso || 700),
    pesoValor: String(TIPOGRAFIA_GLOBAL_GRAFICOS.peso || 700)
});

let dadosGlobais = [];
let graficos = [];
let temporizadorRotacao = null;
let resolverCiclo = null;
let segundosRestantes = TEMPO_SUBVISAO;
let cicloAtivo = false;
let pausado = false;
let pluginDataLabelsDisponivel = false;
let indiceSubvisao = 0;


/* ================================================================
   PLUGINS
   ================================================================ */

function registrarPlugins() {
    pluginDataLabelsDisponivel = false;

    if (typeof Chart === "undefined" || typeof ChartDataLabels === "undefined") {
        return;
    }

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
    if (valor === null || valor === undefined || valor === "") return 0;
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

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
        if (a.mesOrdem !== b.mesOrdem) return a.mesOrdem - b.mesOrdem;
        return a.parceira.localeCompare(b.parceira, "pt-BR");
    });
}

function obterMeses() {
    const mapa = new Map();

    for (const item of dadosGlobais) {
        if (!item.mes || !item.mesOrdem) continue;
        if (!mapa.has(item.mesOrdem)) mapa.set(item.mesOrdem, item.mes);
    }

    return [...mapa.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([ordem, mes]) => ({ ordem, mes }));
}

function obterParceiras() {
    return [...new Set(
        dadosGlobais.map(item => item.parceira).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function somar(registros, campo) {
    return registros.reduce((total, item) => total + numero(item[campo]), 0);
}

function consolidarMes(ordem) {
    const registros = dadosGlobais.filter(item => item.mesOrdem === ordem);

    const coms = somar(registros, "coms");
    const conc = somar(registros, "conc");
    const pend = somar(registros, "pend");

    return {
        coms,
        conc,
        pend,
        projecao: coms + conc + pend,
        faturado: somar(registros, "faturado")
    };
}

function consolidarMesParceira(ordem, parceira) {
    const registros = dadosGlobais.filter(
        item => item.mesOrdem === ordem && item.parceira === parceira
    );

    const coms = somar(registros, "coms");
    const conc = somar(registros, "conc");
    const pend = somar(registros, "pend");

    return {
        coms,
        conc,
        pend,
        projecao: coms + conc + pend,
        faturado: somar(registros, "faturado")
    };
}

function variacaoPercentual(atual, anterior) {
    const base = numero(anterior);
    const valorAtual = numero(atual);

    if (base === 0) {
        if (valorAtual === 0) return 0;
        return null;
    }

    return ((valorAtual - base) / Math.abs(base)) * 100;
}

function classificarTendencia(valor) {
    if (valor === null || !Number.isFinite(valor) || Math.abs(valor) < 0.05) {
        return "neutro";
    }
    return valor > 0 ? "positivo" : "negativo";
}

function obterEstiloTendencia(tendencia) {
    if (tendencia === "positivo") {
        return { cor: CORES.verde, fundo: CORES.verdeBg, seta: "↑" };
    }
    if (tendencia === "negativo") {
        return { cor: CORES.vermelho, fundo: CORES.vermelhoBg, seta: "↓" };
    }
    return { cor: CORES.neutro, fundo: CORES.neutroBg, seta: "•" };
}


/* ================================================================
   FORMATAÇÃO
   ================================================================ */

const MESES_COMPLETOS = {
    jan: "Janeiro",
    fev: "Fevereiro",
    mar: "Março",
    abr: "Abril",
    mai: "Maio",
    jun: "Junho",
    jul: "Julho",
    ago: "Agosto",
    set: "Setembro",
    out: "Outubro",
    nov: "Novembro",
    dez: "Dezembro"
};

function formatarMes(mes) {
    if (!mes) return "--";
    return mes.charAt(0).toUpperCase() + mes.slice(1);
}

function formatarMesCompleto(mes) {
    return MESES_COMPLETOS[mes] || formatarMes(mes);
}

function formatarFinanceiro(valor) {
    const v = numero(valor);
    const absoluto = Math.abs(v);

    if (absoluto >= 1000000) {
        return `R$ ${(v / 1000000).toLocaleString("pt-BR", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        })} mi`;
    }

    if (absoluto >= 1000) {
        return `R$ ${(v / 1000).toLocaleString("pt-BR", {
            maximumFractionDigits: 0
        })} mil`;
    }

    return `R$ ${v.toLocaleString("pt-BR", {
        maximumFractionDigits: 0
    })}`;
}

function formatarPercentualVariacao(valor) {
    if (valor === null || !Number.isFinite(valor)) return "N/D";

    const prefixo = valor > 0 ? "+" : "";
    return `${prefixo}${valor.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    })}%`;
}


/* ================================================================
   HELPERS DE DOM
   ================================================================ */

function aplicarTendenciaBloco(elemento, valor) {
    if (!elemento) return;

    elemento.classList.remove("positivo", "negativo", "neutro");
    elemento.classList.add(classificarTendencia(valor));
}

function atualizarVariacaoResumo(idAtual, idValor, idIcone, atualTexto, valor) {
    const elementoAtual = document.getElementById(idAtual);
    const elementoValor = document.getElementById(idValor);
    const elementoIcone = document.getElementById(idIcone);
    const bloco = elementoValor?.closest(".com-variacao-bloco");
    const tendencia = classificarTendencia(valor);
    const estilo = obterEstiloTendencia(tendencia);

    if (elementoAtual) elementoAtual.textContent = atualTexto;
    if (elementoValor) {
        elementoValor.textContent = formatarPercentualVariacao(valor);
    }

    if (elementoIcone) elementoIcone.textContent = estilo.seta;
    aplicarTendenciaBloco(bloco, valor);
}

function mediaValores(valores, campo) {
    if (!Array.isArray(valores) || valores.length === 0) return 0;
    return valores.reduce((total, item) => total + numero(item?.[campo]), 0) / valores.length;
}

function aplicarTendenciaKpi(bloco, valor) {
    if (!bloco) return;

    const tendencia = classificarTendencia(valor);
    const estilo = obterEstiloTendencia(tendencia);
    const seta = bloco.querySelector(".com-kpi-seta");
    const percentual = bloco.querySelector("strong");

    bloco.classList.remove("positivo", "negativo", "neutro");
    bloco.classList.add(tendencia);

    if (seta) seta.textContent = estilo.seta;
    if (percentual) percentual.textContent = formatarPercentualVariacao(valor);
}

function atualizarKpiLateral(elementoId, _mesAtual, _mesAnterior, _dadosAtual, _dadosAnterior, valoresHistorico) {
    const elemento = document.getElementById(elementoId);
    if (!elemento) return;

    const mediaComs = mediaValores(valoresHistorico, "coms");
    const mediaFaturado = mediaValores(valoresHistorico, "faturado");

    const mediaComsElemento = elemento.querySelector(".com-kpi-media-coms");
    const mediaFaturadoElemento = elemento.querySelector(".com-kpi-media-faturado");

    if (mediaComsElemento) mediaComsElemento.textContent = formatarFinanceiro(mediaComs);
    if (mediaFaturadoElemento) mediaFaturadoElemento.textContent = formatarFinanceiro(mediaFaturado);
}



/* ================================================================
   CHART.JS
   ================================================================ */

function destruirGraficos() {
    graficos.forEach(grafico => {
        try {
            grafico?.destroy();
        } catch (erro) {
            console.warn("Falha ao destruir gráfico de COM-V1:", erro);
        }
    });
    graficos = [];
}

function criarGradienteVertical(ctx, chartArea, corTopo, corBase) {
    if (!chartArea) return corBase;
    const gradiente = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradiente.addColorStop(0, corTopo);
    gradiente.addColorStop(1, corBase);
    return gradiente;
}

function opcoesBaseGrafico({ paddingTop = 44, paddingBottom = 4 } = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        layout: {
            padding: {
                top: paddingTop,
                right: 14,
                bottom: paddingBottom,
                left: 6
            }
        },
        interaction: {
            intersect: false,
            mode: "index"
        },
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
            datalabels: { display: false }
        },
        scales: {
            x: {
                grid: { display: false },
                border: { color: "rgba(49, 80, 116, 0.18)" },
                ticks: {
                    color: "#51677a",
                    font: {
                        size: TIPOGRAFIA_GRAFICOS.rotuloEixo,
                        weight: TIPOGRAFIA_GRAFICOS.pesoEixo
                    },
                    autoSkip: false,
                    maxRotation: 0,
                    minRotation: 0,
                    padding: 10
                }
            },
            y: {
                beginAtZero: true,
                grace: "18%",
                display: false,
                grid: { display: false },
                border: { display: false },
                ticks: { display: false }
            }
        }
    };
}

function obterElementoGrafico(contexto) {
    const chart = contexto?.chart;
    if (!chart || typeof chart.getDatasetMeta !== "function") return null;

    const meta = chart.getDatasetMeta(contexto.datasetIndex);
    return meta?.data?.[contexto.dataIndex] || null;
}

function medirLarguraRotulo(contexto, texto) {
    const ctx = contexto?.chart?.ctx;
    if (!ctx || typeof ctx.measureText !== "function") {
        return String(texto || "").length * TIPOGRAFIA_GRAFICOS.rotuloValor * 0.58;
    }

    ctx.save();
    ctx.font = `${TIPOGRAFIA_GRAFICOS.pesoValor} ${TIPOGRAFIA_GRAFICOS.rotuloValor}px "Segoe UI", Arial, Helvetica, sans-serif`;
    const largura = ctx.measureText(String(texto || "")).width;
    ctx.restore();
    return largura;
}

function calcularPosicaoRotuloBarra(
    contexto,
    { preferenciaExterna = "auto", permitirTopo = true } = {}
) {
    const valor = numero(contexto?.dataset?.data?.[contexto.dataIndex]);
    if (!(valor > 0)) {
        return { display: false, interno: false, anchor: "center", align: "center", offset: 0 };
    }

    const elemento = obterElementoGrafico(contexto);
    const area = contexto?.chart?.chartArea;
    if (!elemento || !area) {
        return { display: true, interno: true, anchor: "center", align: "center", offset: 0 };
    }

    const texto = formatarFinanceiro(valor);
    const larguraRotulo = medirLarguraRotulo(contexto, texto) + 10;
    const alturaRotulo = TIPOGRAFIA_GRAFICOS.rotuloValor + 8;
    const larguraBarra = Math.max(0, numero(elemento.width));
    const alturaBarra = Math.abs(numero(elemento.base) - numero(elemento.y));

    if (
        alturaBarra >= alturaRotulo + 4 &&
        larguraBarra >= larguraRotulo + 4
    ) {
        return { display: true, interno: true, anchor: "center", align: "center", offset: 0 };
    }

    const margem = 7;
    const x = numero(elemento.x);
    const meiaLargura = larguraBarra / 2;
    const espacoEsquerda = (x - meiaLargura) - area.left;
    const espacoDireita = area.right - (x + meiaLargura);

    let lados;
    if (preferenciaExterna === "left") {
        lados = ["left", "right"];
    } else if (preferenciaExterna === "right") {
        lados = ["right", "left"];
    } else {
        lados = contexto.dataIndex % 2 === 0
            ? ["left", "right"]
            : ["right", "left"];
    }

    for (const lado of lados) {
        const espaco = lado === "left" ? espacoEsquerda : espacoDireita;
        if (espaco >= larguraRotulo + margem) {
            return {
                display: true,
                interno: false,
                anchor: "center",
                align: lado,
                offset: margem
            };
        }
    }

    if (permitirTopo) {
        const espacoAcima = numero(elemento.y) - area.top;
        if (espacoAcima >= alturaRotulo + margem) {
            return {
                display: true,
                interno: false,
                anchor: "end",
                align: "top",
                offset: margem
            };
        }
    }

    return { display: false, interno: false, anchor: "center", align: "center", offset: 0 };
}

function criarDatalabelBarra({
    corInterna = "#ffffff",
    corExterna = CORES.texto,
    preferenciaExterna = "auto",
    permitirTopo = true
} = {}) {
    const resolver = contexto => calcularPosicaoRotuloBarra(contexto, {
        preferenciaExterna,
        permitirTopo
    });

    return {
        display(contexto) {
            return pluginDataLabelsDisponivel && resolver(contexto).display;
        },
        color(contexto) {
            return resolver(contexto).interno ? corInterna : corExterna;
        },
        backgroundColor(contexto) {
            return resolver(contexto).interno ? null : "rgba(255,255,255,0.94)";
        },
        borderRadius: 4,
        padding: { top: 2, bottom: 2, left: 4, right: 4 },
        anchor(contexto) {
            return resolver(contexto).anchor;
        },
        align(contexto) {
            return resolver(contexto).align;
        },
        offset(contexto) {
            return resolver(contexto).offset;
        },
        clamp: true,
        clip: false,
        formatter: formatarFinanceiro,
        font: {
            size: TIPOGRAFIA_GRAFICOS.rotuloValor,
            weight: TIPOGRAFIA_GRAFICOS.pesoValor
        }
    };
}

function calcularPosicaoRotuloLinha(contexto) {
    const elemento = obterElementoGrafico(contexto);
    const area = contexto?.chart?.chartArea;

    if (!elemento || !area) {
        return { align: "top", offset: 8 };
    }

    const alturaRotulo = TIPOGRAFIA_GRAFICOS.rotuloValor + 10;
    const margem = 12;
    const y = numero(elemento.y);
    const espacoAcima = y - area.top;
    const espacoAbaixo = area.bottom - y;

    if (espacoAcima >= alturaRotulo + margem) {
        return { align: "top", offset: margem };
    }
    if (espacoAbaixo >= alturaRotulo + margem) {
        return { align: "bottom", offset: margem };
    }

    return { align: espacoAcima >= espacoAbaixo ? "top" : "bottom", offset: 3 };
}

function criarDatalabelLinha({ offsetPadrao = 8 } = {}) {
    return {
        display(contexto) {
            return pluginDataLabelsDisponivel && numero(contexto?.dataset?.data?.[contexto.dataIndex]) > 0;
        },
        color: CORES.linha,
        backgroundColor: "rgba(255,255,255,0.92)",
        borderRadius: 4,
        padding: { top: 2, bottom: 2, left: 4, right: 4 },
        anchor: "center",
        align(contexto) {
            return calcularPosicaoRotuloLinha(contexto).align;
        },
        offset(contexto) {
            const posicao = calcularPosicaoRotuloLinha(contexto);
            return Number.isFinite(posicao.offset) ? posicao.offset : offsetPadrao;
        },
        clamp: true,
        clip: false,
        formatter: formatarFinanceiro,
        font: {
            size: TIPOGRAFIA_GRAFICOS.rotuloValor,
            weight: TIPOGRAFIA_GRAFICOS.pesoValor
        }
    };
}

function criarGraficoResumo(meses, valores) {
    const canvas = document.getElementById("graficoResumo");
    if (!canvas || typeof Chart === "undefined") return;

    const indiceAtual = valores.length - 1;
    const opcoes = opcoesBaseGrafico({ paddingTop: 62 });
    opcoes.scales.x.stacked = true;
    opcoes.scales.y.stacked = true;

    const grafico = new Chart(canvas, {
        type: "bar",
        data: {
            labels: meses.map(item => formatarMes(item.mes)),
            datasets: [
                {
                    type: "bar",
                    label: "COMS",
                    data: valores.map(item => item.coms),
                    backgroundColor(contexto) {
                        const { ctx, chartArea } = contexto.chart;
                        return criarGradienteVertical(ctx, chartArea, "#4e9bec", CORES.azul);
                    },
                    borderRadius: 4,
                    borderSkipped: false,
                    stack: "projecao",
                    barPercentage: 0.64,
                    categoryPercentage: 0.72,
                    order: 1,
                    datalabels: criarDatalabelBarra({
                        corInterna: "#ffffff",
                        corExterna: CORES.azul
                    })
                },
                {
                    type: "bar",
                    label: "CONC",
                    data: valores.map((item, indice) => indice === indiceAtual ? item.conc : 0),
                    backgroundColor: CORES.conc,
                    borderRadius: 3,
                    borderSkipped: false,
                    stack: "projecao",
                    barPercentage: 0.64,
                    categoryPercentage: 0.72,
                    order: 1,
                    datalabels: criarDatalabelBarra({
                        corInterna: CORES.texto,
                        corExterna: CORES.texto,
                        preferenciaExterna: "right",
                        permitirTopo: false
                    })
                },
                {
                    type: "bar",
                    label: "PEND",
                    data: valores.map((item, indice) => indice === indiceAtual ? item.pend : 0),
                    backgroundColor: CORES.pend,
                    borderRadius: 3,
                    borderSkipped: false,
                    stack: "projecao",
                    barPercentage: 0.64,
                    categoryPercentage: 0.72,
                    order: 1,
                    datalabels: criarDatalabelBarra({
                        corInterna: "#5c470d",
                        corExterna: "#5c470d",
                        preferenciaExterna: "left",
                        permitirTopo: true
                    })
                },
                {
                    type: "line",
                    label: "Faturado",
                    data: valores.map(item => item.faturado),
                    borderColor: CORES.linha,
                    backgroundColor: CORES.linha,
                    borderWidth: 3,
                    borderDash: [10, 7],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    pointHitRadius: 8,
                    stepped: "middle",
                    tension: 0,
                    fill: false,
                    order: 0,
                    datalabels: criarDatalabelLinha({ offsetPadrao: 8 })
                }
            ]
        },
        options: opcoes
    });

    graficos.push(grafico);
}

function criarGraficoSmallMultiple(canvas, meses, valores, limiteY) {
    if (!canvas || typeof Chart === "undefined") return;

    const indiceAtual = valores.length - 1;
    const opcoes = opcoesBaseGrafico({ paddingTop: 52, paddingBottom: 2 });
    opcoes.scales.x.stacked = true;
    opcoes.scales.y.stacked = true;
    opcoes.scales.y.grace = "8%";

    if (Number.isFinite(limiteY) && limiteY > 0) {
        opcoes.scales.y.max = limiteY;
    }

    const grafico = new Chart(canvas, {
        type: "bar",
        data: {
            labels: meses.map(item => formatarMes(item.mes)),
            datasets: [
                {
                    type: "bar",
                    label: "COMS",
                    data: valores.map(item => item.coms),
                    backgroundColor(contexto) {
                        const { ctx, chartArea } = contexto.chart;
                        return criarGradienteVertical(ctx, chartArea, "#4e9bec", CORES.azul);
                    },
                    borderRadius: 4,
                    borderSkipped: false,
                    stack: "projecao",
                    barPercentage: 0.66,
                    categoryPercentage: 0.74,
                    order: 1,
                    datalabels: criarDatalabelBarra({
                        corInterna: "#ffffff",
                        corExterna: CORES.azul
                    })
                },
                {
                    type: "bar",
                    label: "CONC",
                    data: valores.map((item, indice) => indice === indiceAtual ? item.conc : 0),
                    backgroundColor: CORES.conc,
                    borderRadius: 3,
                    borderSkipped: false,
                    stack: "projecao",
                    barPercentage: 0.66,
                    categoryPercentage: 0.74,
                    order: 1,
                    datalabels: criarDatalabelBarra({
                        corInterna: CORES.texto,
                        corExterna: CORES.texto,
                        preferenciaExterna: "right",
                        permitirTopo: false
                    })
                },
                {
                    type: "bar",
                    label: "PEND",
                    data: valores.map((item, indice) => indice === indiceAtual ? item.pend : 0),
                    backgroundColor: CORES.pend,
                    borderRadius: 3,
                    borderSkipped: false,
                    stack: "projecao",
                    barPercentage: 0.66,
                    categoryPercentage: 0.74,
                    order: 1,
                    datalabels: criarDatalabelBarra({
                        corInterna: "#5c470d",
                        corExterna: "#5c470d",
                        preferenciaExterna: "left",
                        permitirTopo: true
                    })
                },
                {
                    type: "line",
                    label: "Faturado",
                    data: valores.map(item => item.faturado),
                    borderColor: CORES.linha,
                    backgroundColor: CORES.linha,
                    borderWidth: 2.5,
                    borderDash: [9, 6],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    pointHitRadius: 8,
                    stepped: "middle",
                    tension: 0,
                    fill: false,
                    order: 0,
                    datalabels: criarDatalabelLinha({ offsetPadrao: 6 })
                }
            ]
        },
        options: opcoes
    });

    graficos.push(grafico);
}

function criarCartaoSmallMultiple(rotulo, valorAtual, variacao, classeExtra = "") {
    const tendencia = classificarTendencia(variacao);
    const estilo = obterEstiloTendencia(tendencia);

    const wrapper = document.createElement("div");
    wrapper.className = "com-small-kpi-wrapper";

    const label = document.createElement("div");
    label.className = "com-small-kpi-label";
    label.textContent = rotulo;

    const cartao = document.createElement("div");
    cartao.className = `com-small-kpi ${tendencia} ${classeExtra}`.trim();

    const valorLinha = document.createElement("div");
    valorLinha.className = "com-small-kpi-valor-linha";

    const valor = document.createElement("strong");
    valor.className = "com-small-kpi-valor";
    valor.textContent = formatarFinanceiro(valorAtual);

    const chip = document.createElement("span");
    chip.className = "com-small-kpi-chip";
    chip.innerHTML = `<span class="com-small-kpi-seta">${estilo.seta}</span><strong>${formatarPercentualVariacao(variacao)}</strong>`;

    valorLinha.appendChild(valor);
    valorLinha.appendChild(chip);
    cartao.appendChild(valorLinha);
    wrapper.appendChild(label);
    wrapper.appendChild(cartao);

    return wrapper;
}

function criarCardsSmallMultiple(meses, valores) {
    const container = document.createElement("div");
    container.className = "com-small-multiple-kpis";

    const [mesAnterior, mesAtual] = meses;
    const [dadosAnterior, dadosAtual] = valores;

    const variacaoComs = variacaoPercentual(dadosAtual.coms, dadosAnterior.coms);
    const variacaoProjecao = variacaoPercentual(dadosAtual.projecao, dadosAnterior.coms);
    const variacaoFaturado = variacaoPercentual(dadosAtual.faturado, dadosAnterior.faturado);

    container.appendChild(
        criarCartaoSmallMultiple(
            "Comissionado",
            dadosAtual.coms,
            variacaoComs
        )
    );

    container.appendChild(
        criarCartaoSmallMultiple(
            "Projeção",
            dadosAtual.projecao,
            variacaoProjecao,
            "com-small-kpi-projecao"
        )
    );

    container.appendChild(
        criarCartaoSmallMultiple(
            "Faturado",
            dadosAtual.faturado,
            variacaoFaturado
        )
    );

    return container;
}

function renderizarSmallMultiplesParceiras(parceiras, meses) {
    const container = document.getElementById("smallMultiplesParceiras");
    if (!container) return;

    container.innerHTML = "";

    const series = parceiras.map(parceira => ({
        parceira,
        valores: meses.map(item => consolidarMesParceira(item.ordem, parceira))
    }));

    series.forEach((serie, indice) => {
        const painel = document.createElement("section");
        painel.className = "com-small-multiple";

        const titulo = document.createElement("div");
        titulo.className = "com-small-multiple-titulo";
        titulo.textContent = serie.parceira;

        const graficoBox = document.createElement("div");
        graficoBox.className = "com-grafico com-small-multiple-grafico";

        const canvas = document.createElement("canvas");
        canvas.id = `graficoResumoParceira${indice + 1}`;
        graficoBox.appendChild(canvas);

        const cards = criarCardsSmallMultiple(meses, serie.valores);

        painel.appendChild(titulo);
        painel.appendChild(graficoBox);
        painel.appendChild(cards);
        container.appendChild(painel);

        criarGraficoSmallMultiple(canvas, meses, serie.valores);
    });
}
function criarGraficoHistorico(canvasId, meses, valores) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return;

    const opcoes = opcoesBaseGrafico({ paddingTop: 52 });

    const grafico = new Chart(canvas, {
        type: "bar",
        data: {
            labels: meses.map(item => formatarMes(item.mes)),
            datasets: [
                {
                    type: "bar",
                    label: "Comissionado (COMS)",
                    data: valores.map(item => item.coms),
                    backgroundColor(contexto) {
                        const { ctx, chartArea } = contexto.chart;
                        return criarGradienteVertical(ctx, chartArea, "#4e9bec", CORES.azul);
                    },
                    borderRadius: 4,
                    borderSkipped: false,
                    barPercentage: 0.64,
                    categoryPercentage: 0.72,
                    order: 1,
                    datalabels: criarDatalabelBarra({
                        corInterna: "#ffffff",
                        corExterna: CORES.azul
                    })
                },
                {
                    type: "line",
                    label: "Faturado",
                    data: valores.map(item => item.faturado),
                    borderColor: CORES.linha,
                    backgroundColor: CORES.linha,
                    borderWidth: 3,
                    borderDash: [10, 7],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    pointHitRadius: 8,
                    stepped: "middle",
                    tension: 0,
                    fill: false,
                    order: 0,
                    datalabels: criarDatalabelLinha({ offsetPadrao: 8 })
                }
            ]
        },
        options: opcoes
    });

    graficos.push(grafico);
}


/* ================================================================
   RENDERIZAÇÃO
   ================================================================ */

function atualizarCabecalho() {
    window.PAINEL_BASE?.definirCabecalho({
        titulo: "Comissionamento",
        subtitulo: "",
        contexto: `COMISSIONAMENTO • ${indiceSubvisao + 1}/${TOTAL_SUBVISOES}`
    });
}

function atualizarStatusAtual(mesAtual, dadosAtual) {
    const referencias = [
        ["valorStatusComs", dadosAtual.coms],
        ["valorStatusConc", dadosAtual.conc],
        ["valorStatusPend", dadosAtual.pend]
    ];

    referencias.forEach(([valorId, valor]) => {
        const valorElemento = document.getElementById(valorId);
        if (valorElemento) valorElemento.textContent = formatarFinanceiro(valor);
    });

    const faixaStatus = document.querySelector(".visao-comissionamento .com-status-atual");
    if (faixaStatus) {
        const rotuloMes = formatarMesCompleto(mesAtual?.mes || "");
        faixaStatus.setAttribute(
            "aria-label",
            rotuloMes ? `Status financeiros de ${rotuloMes}` : "Status financeiros do mês atual"
        );
    }
}

function atualizarResumo(meses, valores) {
    const [dadosAnterior, dadosAtual] = valores;

    const variacaoComs = variacaoPercentual(dadosAtual.coms, dadosAnterior.coms);
    const variacaoFaturado = variacaoPercentual(dadosAtual.faturado, dadosAnterior.faturado);
    const variacaoProjecao = variacaoPercentual(dadosAtual.projecao, dadosAnterior.coms);
    atualizarVariacaoResumo(
        "valorComsAtualResumo",
        "variacaoComs",
        "iconeVarComs",
        formatarFinanceiro(dadosAtual.coms),
        variacaoComs
    );

    atualizarVariacaoResumo(
        "valorFaturadoAtualResumo",
        "variacaoFaturado",
        "iconeVarFaturado",
        formatarFinanceiro(dadosAtual.faturado),
        variacaoFaturado
    );

    atualizarVariacaoResumo(
        "valorProjecaoAtualResumo",
        "variacaoProjecao",
        "iconeVarProjecao",
        formatarFinanceiro(dadosAtual.projecao),
        variacaoProjecao
    );
}

function ordenarParceirasHistorico(parceiras) {
    const prioridade = ["PRETEL", "DPL", "CENA"];
    const mapaPrioridade = new Map(prioridade.map((nome, indice) => [nome, indice]));

    return [...parceiras].sort((a, b) => {
        const ordemA = mapaPrioridade.has(a) ? mapaPrioridade.get(a) : prioridade.length;
        const ordemB = mapaPrioridade.has(b) ? mapaPrioridade.get(b) : prioridade.length;

        if (ordemA !== ordemB) return ordemA - ordemB;
        return a.localeCompare(b, "pt-BR");
    });
}

function atualizarSubvisoesDOM() {
    document.querySelectorAll(".visao-comissionamento .com-subvisao").forEach((elemento, indice) => {
        const ativa = indice === indiceSubvisao;
        elemento.classList.toggle("ativa", ativa);
        elemento.setAttribute("aria-hidden", ativa ? "false" : "true");
    });
}

function renderizarTelaResumo(meses, parceiras) {
    const ultimosDois = meses.slice(-ULTIMOS_MESES_RESUMO);

    if (ultimosDois.length < 2) {
        throw new Error("COM-V1 requer pelo menos dois meses para o comparativo.");
    }

    const resumoValores = ultimosDois.map(item => consolidarMes(item.ordem));
    atualizarStatusAtual(ultimosDois[1], resumoValores[1]);
    atualizarResumo(ultimosDois, resumoValores);
    criarGraficoResumo(ultimosDois, resumoValores);
    renderizarSmallMultiplesParceiras(parceiras, ultimosDois);
}

function renderizarTelaHistorico(meses, parceiras) {
    const ultimosSeis = meses.slice(-ULTIMOS_MESES_HISTORICO);
    const parceirasHistorico = ordenarParceirasHistorico(parceiras);

    const slots = [
        ["tituloParceira1", "graficoParceira1", "kpiParceira1"],
        ["tituloParceira2", "graficoParceira2", "kpiParceira2"],
        ["tituloParceira3", "graficoParceira3", "kpiParceira3"]
    ];

    slots.forEach(([tituloId, canvasId, kpiId], indice) => {
        const parceira = parceirasHistorico[indice];
        const titulo = document.getElementById(tituloId);

        if (!parceira) {
            if (titulo) titulo.textContent = "Sem parceira — últimos 6 meses";
            return;
        }

        const valores = ultimosSeis.map(item =>
            consolidarMesParceira(item.ordem, parceira)
        );

        if (titulo) titulo.textContent = `${parceira} — últimos 6 meses`;

        criarGraficoHistorico(canvasId, ultimosSeis, valores);

        if (ultimosSeis.length >= 2) {
            const ultimoIndice = ultimosSeis.length - 1;
            atualizarKpiLateral(
                kpiId,
                ultimosSeis[ultimoIndice],
                ultimosSeis[ultimoIndice - 1],
                valores[ultimoIndice],
                valores[ultimoIndice - 1],
                valores
            );
        }
    });
}

function renderizarSubvisaoAtual() {
    destruirGraficos();
    atualizarSubvisoesDOM();
    atualizarCabecalho();

    if (!dadosGlobais.length) {
        atualizarContador();
        return;
    }

    const meses = obterMeses();
    const parceiras = obterParceiras();

    if (indiceSubvisao === 0) {
        renderizarTelaResumo(meses, parceiras);
    } else {
        renderizarTelaHistorico(meses, parceiras);
    }

    atualizarContador();
}


/* ================================================================
   DADOS
   ================================================================ */

async function carregarDados() {
    const erro = document.getElementById("erro");

    try {
        const resposta = await fetch(`${URL_DADOS}?t=${Date.now()}`, { cache: "no-store" });

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

        if (!normalizados.length) {
            throw new Error("Nenhum registro válido de comissionamento foi encontrado.");
        }

        dadosGlobais = normalizados;
        renderizarSubvisaoAtual();

        if (erro) {
            erro.style.display = "none";
            erro.textContent = "";
        }
    } catch (falha) {
        console.error("Erro ao carregar dados de COM-V1:", falha);

        if (erro) {
            erro.style.display = "block";
            erro.textContent = "Não foi possível carregar os dados de comissionamento.";
        }

        if (dadosGlobais.length) {
            try {
                renderizarSubvisaoAtual();
            } catch (erroRender) {
                console.error("Falha ao renderizar último dado válido de COM-V1:", erroRender);
            }
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
    barra.style.width = `${Math.max(0, (segundosRestantes / TEMPO_SUBVISAO) * 100)}%`;
}

function irParaSubvisao(novoIndice) {
    indiceSubvisao = Math.max(0, Math.min(TOTAL_SUBVISOES - 1, novoIndice));
    segundosRestantes = TEMPO_SUBVISAO;
    renderizarSubvisaoAtual();
    atualizarContador();
}

function avancarAutomaticamente() {
    if (indiceSubvisao < TOTAL_SUBVISOES - 1) {
        irParaSubvisao(indiceSubvisao + 1);
        return;
    }

    concluirCiclo();
}

function iniciarRotacao() {
    pararRotacao();
    cicloAtivo = true;
    segundosRestantes = TEMPO_SUBVISAO;
    atualizarContador();

    temporizadorRotacao = setInterval(() => {
        if (!cicloAtivo || pausado) return;

        segundosRestantes--;
        if (segundosRestantes <= 0) {
            avancarAutomaticamente();
        }
        atualizarContador();
    }, 1000);
}


/* ================================================================
   CICLO DE VIDA — PG-V2
   ================================================================ */

export async function iniciar() {
    indiceSubvisao = 0;
    segundosRestantes = TEMPO_SUBVISAO;
    cicloAtivo = true;
    pausado = false;

    registrarPlugins();
    await carregarDados();

    const ciclo = new Promise(resolve => {
        resolverCiclo = resolve;
    });

    iniciarRotacao();
    return ciclo;
}

export function avancarSubvisao() {
    if (!cicloAtivo) return;

    if (indiceSubvisao < TOTAL_SUBVISOES - 1) {
        irParaSubvisao(indiceSubvisao + 1);
        return;
    }

    concluirCiclo();
}

export function voltarSubvisao() {
    if (!cicloAtivo) return;

    if (indiceSubvisao > 0) {
        irParaSubvisao(indiceSubvisao - 1);
        return;
    }

    segundosRestantes = TEMPO_SUBVISAO;
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
    indiceSubvisao = 0;
    pararRotacao();
    destruirGraficos();
    resolverCiclo = null;
}
