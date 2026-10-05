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

function caminhoArredondado(ctx, x, y, largura, altura, raio) {
    const r = Math.min(raio, largura / 2, altura / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + largura, y, x + largura, y + altura, r);
    ctx.arcTo(x + largura, y + altura, x, y + altura, r);
    ctx.arcTo(x, y + altura, x, y, r);
    ctx.arcTo(x, y, x + largura, y, r);
    ctx.closePath();
}

const pluginVariacaoParceiras = {
    id: "variacaoParceiras",
    afterDraw(chart, _args, opcoes) {
        const variacoes = opcoes?.variacoes;
        const comparacao = opcoes?.comparacao;
        const escalaX = chart.scales?.x;

        if (!escalaX || !Array.isArray(variacoes) || variacoes.length === 0) {
            return;
        }

        const ctx = chart.ctx;
        const yBadge = escalaX.bottom + 20;
        const yComparacao = yBadge + 36;

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        variacoes.forEach((variacao, indice) => {
            const x = escalaX.getPixelForTick(indice);
            const tendencia = classificarTendencia(variacao);
            const estilo = obterEstiloTendencia(tendencia);
            const texto = formatarPercentualVariacao(variacao);
            const seta = tendencia === "positivo" ? "↑" : tendencia === "negativo" ? "↓" : "•";

            const largura = 112;
            const altura = 30;
            const esquerda = x - largura / 2;

            caminhoArredondado(ctx, esquerda, yBadge, largura, altura, 8);
            ctx.fillStyle = estilo.fundo;
            ctx.fill();

            ctx.fillStyle = estilo.cor;
            ctx.font = `${TIPOGRAFIA_GRAFICOS.pesoValor} ${TIPOGRAFIA_GRAFICOS.rotuloValor}px \"Segoe UI\", Arial, sans-serif`;
            ctx.fillText(`${seta}  ${texto}`, x, yBadge + altura / 2);

            ctx.fillStyle = "#83929f";
            ctx.font = `${TIPOGRAFIA_GRAFICOS.pesoEixo} ${TIPOGRAFIA_GRAFICOS.rotuloEixo}px \"Segoe UI\", Arial, sans-serif`;
            ctx.fillText(`vs. ${comparacao || "mês anterior"}`, x, yComparacao);
        });

        ctx.restore();
    }
};


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

    return {
        coms: somar(registros, "coms"),
        faturado: somar(registros, "faturado")
    };
}

function consolidarMesParceira(ordem, parceira) {
    const registros = dadosGlobais.filter(
        item => item.mesOrdem === ordem && item.parceira === parceira
    );

    return {
        coms: somar(registros, "coms"),
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

function conversao(coms, faturado) {
    const base = numero(coms);
    if (base <= 0) return 0;
    return (numero(faturado) / base) * 100;
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

function formatarPercentual(valor) {
    const v = Number.isFinite(valor) ? valor : 0;
    return `${v.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    })}%`;
}

function formatarPercentualVariacao(valor) {
    if (valor === null || !Number.isFinite(valor)) return "N/D";

    const prefixo = valor > 0 ? "+" : "";
    return `${prefixo}${valor.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    })}%`;
}

function formatarPontosPercentuais(valor) {
    const prefixo = valor > 0 ? "+" : "";
    return `${prefixo}${valor.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    })} p.p.`;
}


/* ================================================================
   HELPERS DE DOM
   ================================================================ */

function aplicarTendenciaBloco(elemento, valor) {
    if (!elemento) return;

    elemento.classList.remove("positivo", "negativo", "neutro");
    elemento.classList.add(classificarTendencia(valor));
}

function atualizarVariacaoResumo(idAtual, idValor, idIcone, idDetalhe, atualTexto, valor, detalhe, tipo = "percentual") {
    const elementoAtual = document.getElementById(idAtual);
    const elementoValor = document.getElementById(idValor);
    const elementoIcone = document.getElementById(idIcone);
    const elementoDetalhe = document.getElementById(idDetalhe);
    const bloco = elementoValor?.closest(".com-variacao-bloco");
    const tendencia = classificarTendencia(valor);
    const estilo = obterEstiloTendencia(tendencia);

    if (elementoAtual) elementoAtual.textContent = atualTexto;
    if (elementoValor) {
        elementoValor.textContent = tipo === "pp"
            ? formatarPontosPercentuais(valor || 0)
            : formatarPercentualVariacao(valor);
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

    const opcoes = opcoesBaseGrafico({ paddingTop: 34 });

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
                    datalabels: {
                        display: pluginDataLabelsDisponivel,
                        color: CORES.texto,
                        anchor: "end",
                        align: "top",
                        offset: 4,
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
                    borderWidth: 3,
                    pointRadius: 5,
                    pointHoverRadius: 5,
                    pointBackgroundColor: CORES.linha,
                    pointBorderColor: "#ffffff",
                    pointBorderWidth: 2,
                    tension: 0.12,
                    fill: false,
                    order: 0,
                    datalabels: {
                        display: pluginDataLabelsDisponivel,
                        color: CORES.linha,
                        backgroundColor: "rgba(255,255,255,0.88)",
                        borderRadius: 4,
                        padding: { top: 2, bottom: 2, left: 4, right: 4 },
                        anchor: "center",
                        align: context => context.dataIndex === 0 ? "bottom" : "top",
                        offset: 10,
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

function criarGraficoParceiras(parceiras, mesAnterior, mesAtual) {
    const canvas = document.getElementById("graficoParceiras");
    if (!canvas || typeof Chart === "undefined") return;

    const anterior = parceiras.map(parceira => consolidarMesParceira(mesAnterior.ordem, parceira));
    const atual = parceiras.map(parceira => consolidarMesParceira(mesAtual.ordem, parceira));
    const variacoes = parceiras.map((_, indice) =>
        variacaoPercentual(atual[indice].coms, anterior[indice].coms)
    );

    const opcoes = opcoesBaseGrafico({ paddingTop: 32, paddingBottom: 66 });
    opcoes.plugins.variacaoParceiras = {
        variacoes,
        comparacao: formatarMesCompleto(mesAnterior.mes)
    };

    const grafico = new Chart(canvas, {
        type: "bar",
        data: {
            labels: parceiras,
            datasets: [
                {
                    label: formatarMes(mesAnterior.mes),
                    data: anterior.map(item => item.coms),
                    backgroundColor: CORES.azulClaro,
                    borderRadius: 3,
                    borderSkipped: false,
                    barPercentage: 0.78,
                    categoryPercentage: 0.70,
                    datalabels: {
                        display: pluginDataLabelsDisponivel,
                        color: CORES.texto,
                        anchor: "end",
                        align: "top",
                        offset: 3,
                        clamp: true,
                        formatter: formatarFinanceiro,
                        font: {
                            size: TIPOGRAFIA_GRAFICOS.rotuloValor,
                            weight: TIPOGRAFIA_GRAFICOS.pesoValor
                        }
                    }
                },
                {
                    label: formatarMes(mesAtual.mes),
                    data: atual.map(item => item.coms),
                    backgroundColor: CORES.azul,
                    borderRadius: 3,
                    borderSkipped: false,
                    barPercentage: 0.78,
                    categoryPercentage: 0.70,
                    datalabels: {
                        display: pluginDataLabelsDisponivel,
                        color: CORES.texto,
                        anchor: "end",
                        align: "top",
                        offset: 3,
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
        options: opcoes,
        plugins: [pluginVariacaoParceiras]
    });

    graficos.push(grafico);
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

function atualizarLegendaParceiras(mesAnterior, mesAtual) {
    const legenda = document.getElementById("legendaMesesParceiras");
    if (!legenda) return;

    legenda.innerHTML = `
        <span class="com-legenda-item">
            <span class="com-legenda-barra com-legenda-barra-anterior"></span>
            <span>${formatarMes(mesAnterior.mes)}</span>
        </span>
        <span class="com-legenda-item">
            <span class="com-legenda-barra com-legenda-barra-ultimo"></span>
            <span>${formatarMes(mesAtual.mes)}</span>
        </span>
    `;
}

function atualizarResumo(meses, valores) {
    const [mesAnterior, mesAtual] = meses;
    const [dadosAnterior, dadosAtual] = valores;

    const variacaoComs = variacaoPercentual(dadosAtual.coms, dadosAnterior.coms);
    const variacaoFaturado = variacaoPercentual(dadosAtual.faturado, dadosAnterior.faturado);
    const conversaoAnterior = conversao(dadosAnterior.coms, dadosAnterior.faturado);
    const conversaoAtual = conversao(dadosAtual.coms, dadosAtual.faturado);
    const variacaoConversao = conversaoAtual - conversaoAnterior;

    atualizarVariacaoResumo(
        "valorComsAtualResumo",
        "variacaoComs",
        "iconeVarComs",
        "detalheVarComs",
        formatarFinanceiro(dadosAtual.coms),
        variacaoComs,
        `vs. ${formatarMesCompleto(meses[0].mes)}`
    );

    atualizarVariacaoResumo(
        "valorFaturadoAtualResumo",
        "variacaoFaturado",
        "iconeVarFaturado",
        "detalheVarFaturado",
        formatarFinanceiro(dadosAtual.faturado),
        variacaoFaturado,
        `vs. ${formatarMesCompleto(meses[0].mes)}`
    );

    atualizarVariacaoResumo(
        "valorConversaoAtualResumo",
        "variacaoConversao",
        "iconeVarConversao",
        "detalheVarConversao",
        formatarPercentual(conversaoAtual),
        variacaoConversao,
        `vs. ${formatarMesCompleto(meses[0].mes)}`,
        "pp"
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
    atualizarLegendaParceiras(ultimosDois[0], ultimosDois[1]);

    criarGraficoResumo(ultimosDois, resumoValores);
    criarGraficoParceiras(parceiras, ultimosDois[0], ultimosDois[1]);

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
