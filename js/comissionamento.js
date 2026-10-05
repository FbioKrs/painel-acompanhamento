/* ================================================================
   COMISSIONAMENTO DE OBRAS — COM-V1
   Comparativo financeiro de COMS e Faturado
   ================================================================ */

const URL_DADOS = "./dados/base_comissionamento.json";
const TEMPO_VISAO = 15;
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

const TIPOGRAFIA_GRAFICOS = Object.freeze({
    rotuloEixo: 14,
    rotuloValor: 14,
    pesoEixo: "700",
    pesoValor: "800"
});

let dadosGlobais = [];
let graficos = [];
let temporizadorRotacao = null;
let resolverCiclo = null;
let segundosRestantes = TEMPO_VISAO;
let cicloAtivo = false;
let pausado = false;
let pluginDataLabelsDisponivel = false;


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

function atualizarVariacaoResumo(idAtual, idValor, idIcone, idDetalhe, atualTexto, valor, detalhe) {
    const elementoAtual = document.getElementById(idAtual);
    const elementoValor = document.getElementById(idValor);
    const elementoIcone = document.getElementById(idIcone);
    const elementoDetalhe = document.getElementById(idDetalhe);
    const bloco = elementoValor?.closest(".com-variacao-bloco");
    const tendencia = classificarTendencia(valor);
    const estilo = obterEstiloTendencia(tendencia);

    if (elementoAtual) elementoAtual.textContent = atualTexto;
    if (elementoValor) {
        elementoValor.textContent = formatarPercentualVariacao(valor);
    }

    if (elementoIcone) elementoIcone.textContent = estilo.seta;
    if (elementoDetalhe) elementoDetalhe.textContent = detalhe;
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

function atualizarKpiLateral(elementoId, mesAtual, mesAnterior, dadosAtual, dadosAnterior, valoresHistorico) {
    const elemento = document.getElementById(elementoId);
    if (!elemento) return;

    const variacaoComs = variacaoPercentual(dadosAtual.coms, dadosAnterior.coms);
    const variacaoFaturado = variacaoPercentual(dadosAtual.faturado, dadosAnterior.faturado);
    const mediaComs = mediaValores(valoresHistorico, "coms");
    const mediaFaturado = mediaValores(valoresHistorico, "faturado");

    const comsAtual = elemento.querySelector(".com-kpi-coms-atual");
    const faturadoAtual = elemento.querySelector(".com-kpi-faturado-atual");
    const mediaComsElemento = elemento.querySelector(".com-kpi-media-coms");
    const mediaFaturadoElemento = elemento.querySelector(".com-kpi-media-faturado");
    const comparacaoComs = elemento.querySelector(".com-kpi-comp-coms");
    const comparacaoFaturado = elemento.querySelector(".com-kpi-comp-faturado");

    if (comsAtual) comsAtual.textContent = formatarFinanceiro(dadosAtual.coms);
    if (faturadoAtual) faturadoAtual.textContent = formatarFinanceiro(dadosAtual.faturado);
    if (mediaComsElemento) mediaComsElemento.textContent = formatarFinanceiro(mediaComs);
    if (mediaFaturadoElemento) mediaFaturadoElemento.textContent = formatarFinanceiro(mediaFaturado);

    const textoComparacao = `vs. ${formatarMesCompleto(mesAnterior?.mes || "")}`;
    if (comparacaoComs) comparacaoComs.textContent = textoComparacao;
    if (comparacaoFaturado) comparacaoFaturado.textContent = textoComparacao;

    aplicarTendenciaKpi(elemento.querySelector(".com-kpi-var-coms"), variacaoComs);
    aplicarTendenciaKpi(elemento.querySelector(".com-kpi-var-faturado"), variacaoFaturado);
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

function opcoesBaseGrafico({ paddingTop = 22, paddingBottom = 2 } = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        layout: {
            padding: {
                top: paddingTop,
                right: 8,
                bottom: paddingBottom,
                left: 0
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
                    padding: 7
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

function criarGraficoResumo(meses, valores) {
    const canvas = document.getElementById("graficoResumo");
    if (!canvas || typeof Chart === "undefined") return;

    const indiceAtual = valores.length - 1;
    const opcoes = opcoesBaseGrafico({ paddingTop: 38 });
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
                    datalabels: {
                        display: pluginDataLabelsDisponivel,
                        color: "#ffffff",
                        anchor: "center",
                        align: "center",
                        clamp: true,
                        formatter: formatarFinanceiro,
                        font: {
                            size: TIPOGRAFIA_GRAFICOS.rotuloValor,
                            weight: TIPOGRAFIA_GRAFICOS.pesoValor
                        }
                    }
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
                    datalabels: { display: false }
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
                    datalabels: { display: false }
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
                    datalabels: {
                        display: pluginDataLabelsDisponivel,
                        color: CORES.linha,
                        backgroundColor: "rgba(255,255,255,0.90)",
                        borderRadius: 4,
                        padding: { top: 2, bottom: 2, left: 4, right: 4 },
                        anchor: "end",
                        align: "top",
                        offset: 8,
                        clamp: true,
                        formatter: formatarFinanceiro,
                        font: {
                            size: TIPOGRAFIA_GRAFICOS.rotuloValor,
                            weight: TIPOGRAFIA_GRAFICOS.pesoValor
                        }
                    }
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
    const opcoes = opcoesBaseGrafico({ paddingTop: 34, paddingBottom: 0 });
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
                    datalabels: {
                        display: pluginDataLabelsDisponivel,
                        color: "#ffffff",
                        anchor: "center",
                        align: "center",
                        clamp: true,
                        formatter: formatarFinanceiro,
                        font: {
                            size: TIPOGRAFIA_GRAFICOS.rotuloValor,
                            weight: TIPOGRAFIA_GRAFICOS.pesoValor
                        }
                    }
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
                    datalabels: { display: false }
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
                    datalabels: { display: false }
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
                    datalabels: {
                        display: pluginDataLabelsDisponivel,
                        color: CORES.linha,
                        backgroundColor: "rgba(255,255,255,0.90)",
                        borderRadius: 4,
                        padding: { top: 2, bottom: 2, left: 3, right: 3 },
                        anchor: "end",
                        align: "top",
                        offset: 6,
                        clamp: true,
                        formatter: formatarFinanceiro,
                        font: {
                            size: TIPOGRAFIA_GRAFICOS.rotuloValor,
                            weight: TIPOGRAFIA_GRAFICOS.pesoValor
                        }
                    }
                }
            ]
        },
        options: opcoes
    });

    graficos.push(grafico);
}

function criarCartaoSmallMultiple(rotulo, valorAtual, variacao, detalhe, classeExtra = "") {
    const tendencia = classificarTendencia(variacao);
    const estilo = obterEstiloTendencia(tendencia);

    const cartao = document.createElement("div");
    cartao.className = `com-small-kpi ${tendencia} ${classeExtra}`.trim();

    const label = document.createElement("div");
    label.className = "com-small-kpi-label";
    label.textContent = rotulo;

    const valorLinha = document.createElement("div");
    valorLinha.className = "com-small-kpi-valor-linha";

    const valor = document.createElement("strong");
    valor.className = "com-small-kpi-valor";
    valor.textContent = formatarFinanceiro(valorAtual);

    const chip = document.createElement("span");
    chip.className = "com-small-kpi-chip";
    chip.innerHTML = `<span class="com-small-kpi-seta">${estilo.seta}</span><strong>${formatarPercentualVariacao(variacao)}</strong>`;

    const detalheElemento = document.createElement("div");
    detalheElemento.className = "com-small-kpi-detalhe";
    detalheElemento.textContent = detalhe;

    valorLinha.appendChild(valor);
    valorLinha.appendChild(chip);
    cartao.appendChild(label);
    cartao.appendChild(valorLinha);
    cartao.appendChild(detalheElemento);

    return cartao;
}

function criarCardsSmallMultiple(meses, valores) {
    const container = document.createElement("div");
    container.className = "com-small-multiple-kpis";

    const [mesAnterior, mesAtual] = meses;
    const [dadosAnterior, dadosAtual] = valores;

    const variacaoComs = variacaoPercentual(dadosAtual.coms, dadosAnterior.coms);
    const variacaoProjecao = variacaoPercentual(dadosAtual.projecao, dadosAnterior.coms);
    const variacaoFaturado = variacaoPercentual(dadosAtual.faturado, dadosAnterior.faturado);

    const referenciaAnterior = `vs. ${formatarMesCompleto(mesAnterior?.mes || "")}`;
    const referenciaProjecao = `vs. ${formatarMesCompleto(mesAnterior?.mes || "")} (COMS)`;

    container.appendChild(
        criarCartaoSmallMultiple(
            "Comissionado",
            dadosAtual.coms,
            variacaoComs,
            referenciaAnterior
        )
    );

    container.appendChild(
        criarCartaoSmallMultiple(
            "Projeção de Comissionamento",
            dadosAtual.projecao,
            variacaoProjecao,
            referenciaProjecao,
            "com-small-kpi-projecao"
        )
    );

    container.appendChild(
        criarCartaoSmallMultiple(
            "Faturado",
            dadosAtual.faturado,
            variacaoFaturado,
            referenciaAnterior
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

    const maiorValor = series.reduce((maior, serie) => {
        for (const item of serie.valores) {
            maior = Math.max(maior, item.projecao, item.faturado);
        }
        return maior;
    }, 0);

    const limiteY = maiorValor > 0 ? maiorValor * 1.22 : undefined;

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

        criarGraficoSmallMultiple(canvas, meses, serie.valores, limiteY);
    });
}
function criarGraficoHistorico(canvasId, meses, valores) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return;

    const ultimoIndice = meses.length - 1;
    const opcoes = opcoesBaseGrafico({ paddingTop: 28 });

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
                        if (contexto.dataIndex === ultimoIndice) return CORES.azul;
                        const { ctx, chartArea } = contexto.chart;
                        return criarGradienteVertical(ctx, chartArea, "#76b5f1", "#4a96e4");
                    },
                    borderRadius: 3,
                    borderSkipped: false,
                    barPercentage: 0.66,
                    categoryPercentage: 0.78,
                    order: 1,
                    datalabels: {
                        display: pluginDataLabelsDisponivel,
                        color: CORES.texto,
                        anchor: "end",
                        align: "top",
                        offset: 2,
                        clamp: true,
                        formatter: formatarFinanceiro,
                        font: {
                            size: TIPOGRAFIA_GRAFICOS.rotuloValor,
                            weight: TIPOGRAFIA_GRAFICOS.pesoValor
                        }
                    }
                },
                {
                    type: "line",
                    label: "Faturado",
                    data: valores.map(item => item.faturado),
                    borderColor: CORES.linha,
                    backgroundColor: CORES.linha,
                    borderWidth: 2.5,
                    pointRadius: 4,
                    pointHoverRadius: 4,
                    pointBackgroundColor: CORES.linha,
                    pointBorderColor: "#ffffff",
                    pointBorderWidth: 2,
                    tension: 0.15,
                    fill: false,
                    order: 0,
                    datalabels: { display: false }
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
        titulo: "Comissionamento por Parceira",
        subtitulo: "COMS x Faturado",
        contexto: "COMISSIONAMENTO"
    });
}

function atualizarResumo(meses, valores) {
    const [dadosAnterior, dadosAtual] = valores;

    const variacaoComs = variacaoPercentual(dadosAtual.coms, dadosAnterior.coms);
    const variacaoFaturado = variacaoPercentual(dadosAtual.faturado, dadosAnterior.faturado);
    const variacaoProjecao = variacaoPercentual(dadosAtual.projecao, dadosAnterior.coms);
    const referenciaAnterior = `vs. ${formatarMesCompleto(meses[0].mes)}`;
    const referenciaProjecao = `vs. ${formatarMesCompleto(meses[0].mes)} (COMS)`;

    atualizarVariacaoResumo(
        "valorComsAtualResumo",
        "variacaoComs",
        "iconeVarComs",
        "detalheVarComs",
        formatarFinanceiro(dadosAtual.coms),
        variacaoComs,
        referenciaAnterior
    );

    atualizarVariacaoResumo(
        "valorFaturadoAtualResumo",
        "variacaoFaturado",
        "iconeVarFaturado",
        "detalheVarFaturado",
        formatarFinanceiro(dadosAtual.faturado),
        variacaoFaturado,
        referenciaAnterior
    );

    atualizarVariacaoResumo(
        "valorProjecaoAtualResumo",
        "variacaoProjecao",
        "iconeVarProjecao",
        "detalheVarProjecao",
        formatarFinanceiro(dadosAtual.projecao),
        variacaoProjecao,
        referenciaProjecao
    );
}

function renderizarVisao() {
    if (!dadosGlobais.length) return;

    destruirGraficos();
    atualizarCabecalho();

    const meses = obterMeses();
    const parceiras = obterParceiras();
    const ultimosDois = meses.slice(-ULTIMOS_MESES_RESUMO);
    const ultimosSeis = meses.slice(-ULTIMOS_MESES_HISTORICO);

    if (ultimosDois.length < 2) {
        throw new Error("COM-V1 requer pelo menos dois meses para o comparativo.");
    }

    const resumoValores = ultimosDois.map(item => consolidarMes(item.ordem));
    atualizarResumo(ultimosDois, resumoValores);

    criarGraficoResumo(ultimosDois, resumoValores);
    renderizarSmallMultiplesParceiras(parceiras, ultimosDois);

    const slots = [
        ["tituloParceira1", "subtituloParceira1", "graficoParceira1", "kpiParceira1"],
        ["tituloParceira2", "subtituloParceira2", "graficoParceira2", "kpiParceira2"],
        ["tituloParceira3", "subtituloParceira3", "graficoParceira3", "kpiParceira3"]
    ];

    slots.forEach(([tituloId, subtituloId, canvasId, kpiId], indice) => {
        const parceira = parceiras[indice];
        const titulo = document.getElementById(tituloId);
        const subtitulo = document.getElementById(subtituloId);

        if (!parceira) {
            if (titulo) titulo.textContent = "Sem parceira — últimos 6 meses";
            return;
        }

        const valores = ultimosSeis.map(item =>
            consolidarMesParceira(item.ordem, parceira)
        );

        if (titulo) titulo.textContent = `${parceira} — últimos 6 meses`;
        if (subtitulo && ultimosSeis.length) {
            subtitulo.textContent = `COMS x Faturado • ${formatarMes(ultimosSeis[0].mes)} – ${formatarMes(ultimosSeis[ultimosSeis.length - 1].mes)}`;
        }

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
        renderizarVisao();

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
                renderizarVisao();
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
    barra.style.width = `${Math.max(0, (segundosRestantes / TEMPO_VISAO) * 100)}%`;
}

function iniciarRotacao() {
    pararRotacao();
    cicloAtivo = true;
    segundosRestantes = TEMPO_VISAO;
    atualizarContador();

    temporizadorRotacao = setInterval(() => {
        if (!cicloAtivo || pausado) return;

        segundosRestantes--;
        if (segundosRestantes <= 0) concluirCiclo();
        atualizarContador();
    }, 1000);
}


/* ================================================================
   CICLO DE VIDA — PG-V2
   ================================================================ */

export async function iniciar() {
    segundosRestantes = TEMPO_VISAO;
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
