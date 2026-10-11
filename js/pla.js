/* ================================================================
   PLA-V1 — Percentual de Ligações Atrasadas
   ================================================================ */

const TEMPO_VISAO = 15;
const URL_DADOS = "./dados/pla.json";
const TEMPO_ATUALIZACAO_DADOS =
    Number(window.PAINEL_CONFIG?.atualizacao?.intervaloPadraoMs) || 60000;

const TIPOGRAFIA_GRAFICOS = Object.freeze({
    eixo: Number(window.PAINEL_CONFIG?.tipografia?.grafico?.eixo) || 22,
    legenda: Number(window.PAINEL_CONFIG?.tipografia?.grafico?.legenda) || 22,
    valor: Number(window.PAINEL_CONFIG?.tipografia?.grafico?.valor) || 22,
    peso: String(window.PAINEL_CONFIG?.tipografia?.grafico?.peso || 700)
});

const CORES = Object.freeze({
    azul: "#2f73d9",
    azulEscuro: "#17345f",
    azulClaro: "#eaf3ff",
    verde: "#18a368",
    verdeFundo: "#e9f8f1",
    vermelho: "#e14343",
    vermelhoFundo: "#ffeded",
    cinza: "#74808a",
    grade: "#d8e2ea",
    roxo: "#7967c7",
    ciano: "#49a7df"
});

const ESTILOS_REGIONAIS = Object.freeze([
    { cor: CORES.azulEscuro, pointStyle: "circle", classe: "circulo" },
    { cor: CORES.ciano, pointStyle: "rect", classe: "quadrado" },
    { cor: CORES.verde, pointStyle: "triangle", classe: "triangulo" },
    { cor: CORES.roxo, pointStyle: "rectRot", classe: "losango" }
]);

let dadosValidos = null;
let graficoNoPrazo = null;
let graficoForaPrazo = null;
let graficoRegionais = null;
let temporizadorRotacao = null;
let temporizadorAtualizacao = null;
let segundosRestantes = TEMPO_VISAO;
let resolverCiclo = null;
let cicloAtivo = false;
let pausado = false;

function numero(valor) {
    if (valor === null || valor === undefined || valor === "") return 0;
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

    const texto = String(valor).trim();
    const normalizado = texto.includes(",")
        ? texto.replace(/\./g, "").replace(",", ".")
        : texto;
    const resultado = Number(normalizado);
    return Number.isFinite(resultado) ? resultado : 0;
}

function formatarInteiro(valor) {
    return Math.round(numero(valor)).toLocaleString("pt-BR");
}

function formatarPercentual(valor) {
    return `${numero(valor).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}%`;
}

function formatarPontosPercentuais(valor) {
    const absoluto = Math.abs(numero(valor)).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    if (valor < 0) return `↓ ${absoluto} p.p.`;
    if (valor > 0) return `↑ ${absoluto} p.p.`;
    return `• ${absoluto} p.p.`;
}

function calcularPla(apuracao) {
    const fora = numero(apuracao?.foraPrazo);
    const noPrazo = numero(apuracao?.noPrazo);
    const total = fora + noPrazo;
    return total > 0 ? (fora / total) * 100 : 0;
}

function ordenarApuracoes(apuracoes) {
    return [...(Array.isArray(apuracoes) ? apuracoes : [])].sort((a, b) => {
        const ordemA = numero(a?.ordem);
        const ordemB = numero(b?.ordem);
        if (ordemA !== ordemB) return ordemA - ordemB;
        return String(a?.periodo || "").localeCompare(String(b?.periodo || ""));
    });
}

function ordenarMovimentacoes(movimentacoes) {
    return [...(Array.isArray(movimentacoes) ? movimentacoes : [])].sort(
        (a, b) => numero(a?.ordem) - numero(b?.ordem)
    );
}

function rotuloPeriodo(apuracao) {
    if (apuracao?.rotulo) return String(apuracao.rotulo);
    const periodo = String(apuracao?.periodo || "");
    const match = periodo.match(/^(\d{4})-(\d{2})$/);
    if (!match) return periodo || "--";

    const nomes = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    return `${nomes[Number(match[2]) - 1]}/${match[1].slice(-2)}`;
}

function rotuloData(valor) {
    const texto = String(valor || "");
    const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}` : texto;
}

function formatarDataHora(valor) {
    if (!valor) return "--";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return String(valor);
    return data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function registrarDatalabels() {
    if (!window.Chart || !window.ChartDataLabels) return;
    try {
        window.Chart.register(window.ChartDataLabels);
    } catch (erro) {
        console.warn("PLA-V1: ChartDataLabels já registrado ou indisponível.", erro);
    }
}

function exibirErro(mensagem) {
    const elemento = document.getElementById("plaErro");
    if (!elemento) return;
    elemento.textContent = mensagem || "";
    elemento.classList.toggle("ativo", Boolean(mensagem));
}

function limparGraficos() {
    [graficoNoPrazo, graficoForaPrazo, graficoRegionais].forEach(grafico => {
        try {
            grafico?.destroy();
        } catch (erro) {
            console.warn("PLA-V1: falha ao destruir gráfico.", erro);
        }
    });
    graficoNoPrazo = null;
    graficoForaPrazo = null;
    graficoRegionais = null;
}

function prepararMovimentacoes(dados, anterior, atual) {
    const movimentacoes = ordenarMovimentacoes(dados?.movimentacoes).map(item => ({
        ordem: numero(item?.ordem),
        evento: String(item?.evento || "Movimentação"),
        rotulo: String(item?.rotulo || item?.evento || "Mov."),
        noPrazo: numero(item?.noPrazo),
        foraPrazo: numero(item?.foraPrazo)
    }));

    const somaNoPrazo = movimentacoes.reduce((total, item) => total + item.noPrazo, 0);
    const somaForaPrazo = movimentacoes.reduce((total, item) => total + item.foraPrazo, 0);

    const residualNoPrazo = numero(atual?.noPrazo) - (numero(anterior?.noPrazo) + somaNoPrazo);
    const residualForaPrazo = numero(atual?.foraPrazo) - (numero(anterior?.foraPrazo) + somaForaPrazo);

    if (Math.abs(residualNoPrazo) > 0.0001 || Math.abs(residualForaPrazo) > 0.0001) {
        movimentacoes.push({
            ordem: movimentacoes.length + 1,
            evento: "Ajuste de conciliação",
            rotulo: "Ajuste",
            noPrazo: residualNoPrazo,
            foraPrazo: residualForaPrazo
        });
    }

    return movimentacoes;
}

function construirSerieMovimentos(anterior, atual, movimentacoes, campo) {
    const labels = ["Anterior"];
    const valores = [numero(anterior?.[campo])];
    const deltas = [null];
    let acumulado = numero(anterior?.[campo]);

    movimentacoes.forEach(item => {
        const delta = numero(item?.[campo]);
        acumulado += delta;
        labels.push(item.rotulo);
        valores.push(acumulado);
        deltas.push(delta);
    });

    labels.push("Atual");
    valores.push(numero(atual?.[campo]));
    deltas.push(null);

    return { labels, valores, deltas };
}

function corMovimentacao(campo, delta) {
    if (delta === 0) return CORES.cinza;
    if (campo === "noPrazo") return delta > 0 ? CORES.verde : CORES.vermelho;
    return delta < 0 ? CORES.verde : CORES.vermelho;
}

function criarGraficoMovimentacao(canvasId, serie, campo, corLinha) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return null;

    const ultimoIndice = serie.valores.length - 1;

    return new window.Chart(canvas, {
        type: "line",
        data: {
            labels: serie.labels,
            datasets: [{
                label: campo === "noPrazo" ? "No Prazo" : "Fora Prazo",
                data: serie.valores,
                borderColor: corLinha,
                backgroundColor: corLinha,
                borderWidth: 4,
                tension: 0.16,
                fill: false,
                pointRadius: 6,
                pointHoverRadius: 6,
                pointBorderWidth: 3,
                pointBorderColor: corLinha,
                pointBackgroundColor: "#ffffff",
                datalabels: {
                    display: true,
                    formatter(valor, contexto) {
                        const indice = contexto.dataIndex;
                        if (indice === 0 || indice === ultimoIndice) {
                            return formatarInteiro(valor);
                        }
                        return `${serie.deltas[indice] > 0 ? "+" : ""}${formatarInteiro(serie.deltas[indice])}`;
                    },
                    color(contexto) {
                        const indice = contexto.dataIndex;
                        if (indice === 0) return CORES.azulEscuro;
                        if (indice === ultimoIndice) return CORES.verde;
                        return corMovimentacao(campo, numero(serie.deltas[indice]));
                    },
                    backgroundColor(contexto) {
                        const indice = contexto.dataIndex;
                        if (indice === 0) return CORES.azulClaro;
                        if (indice === ultimoIndice) return CORES.verdeFundo;
                        return null;
                    },
                    borderRadius: 9,
                    padding: 6,
                    anchor: "end",
                    align(contexto) {
                        const indice = contexto.dataIndex;
                        if (indice === 0 || indice === ultimoIndice) return "top";
                        return numero(serie.deltas[indice]) >= 0 ? "top" : "bottom";
                    },
                    offset: 4,
                    clamp: true,
                    clip: false,
                    font: {
                        family: '"Segoe UI", Arial, Helvetica, sans-serif',
                        size: TIPOGRAFIA_GRAFICOS.valor,
                        weight: TIPOGRAFIA_GRAFICOS.peso
                    }
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            events: [],
            layout: {
                padding: { top: 22, right: 16, bottom: 0, left: 10 }
            },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        color: "#506170",
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: false,
                        padding: 8,
                        font: {
                            family: '"Segoe UI", Arial, Helvetica, sans-serif',
                            size: TIPOGRAFIA_GRAFICOS.eixo,
                            weight: TIPOGRAFIA_GRAFICOS.peso
                        }
                    }
                },
                y: {
                    display: true,
                    grace: "22%",
                    grid: { display: false },
                    border: { display: false },
                    ticks: { display: false }
                }
            }
        }
    });
}

function obterEstiloRegional(nome, indice, foco) {
    if (nome === foco) return ESTILOS_REGIONAIS[0];
    const alternativos = ESTILOS_REGIONAIS.slice(1);
    return alternativos[indice % alternativos.length];
}

function criarLegendaRegionais(regionais, foco) {
    const container = document.getElementById("plaLegendaRegionais");
    if (!container) return;
    container.innerHTML = "";

    const ordenadas = [
        ...regionais.filter(nome => nome === foco),
        ...regionais.filter(nome => nome !== foco)
    ];

    ordenadas.forEach((nome, indice) => {
        const estilo = obterEstiloRegional(nome, Math.max(0, indice - 1), foco);
        const item = document.createElement("span");
        item.className = "pla-legenda-item";

        const marcador = document.createElement("span");
        marcador.className = `pla-legenda-marcador ${estilo.classe}`;
        marcador.style.color = estilo.cor;

        const texto = document.createElement("span");
        texto.textContent = nome;

        item.appendChild(marcador);
        item.appendChild(texto);
        container.appendChild(item);
    });
}

function criarGraficoRegional(dados) {
    const canvas = document.getElementById("plaGraficoRegionais");
    if (!canvas || !window.Chart) return null;

    const historico = Array.isArray(dados?.historicoRegional) ? dados.historicoRegional : [];
    const regionaisOriginais = Array.isArray(dados?.regionais) ? dados.regionais.map(String) : [];
    const foco = String(dados?.regionalFoco || regionaisOriginais[0] || "Metropolitana");
    const regionais = regionaisOriginais.length ? regionaisOriginais : [foco];

    criarLegendaRegionais(regionais, foco);

    const labels = historico.map(item => rotuloData(item?.data || item?.rotulo));
    const ordenadas = [
        ...regionais.filter(nome => nome === foco),
        ...regionais.filter(nome => nome !== foco)
    ];

    const datasets = ordenadas.map((nome, indice) => {
        const estilo = obterEstiloRegional(nome, Math.max(0, indice - 1), foco);
        const valores = historico.map(item => numero(item?.valores?.[nome] ?? item?.[nome]));
        const ultimoIndice = valores.length - 1;

        return {
            label: nome,
            data: valores,
            borderColor: estilo.cor,
            backgroundColor: estilo.cor,
            borderWidth: nome === foco ? 5 : 3,
            tension: 0.18,
            fill: false,
            pointStyle: estilo.pointStyle,
            pointRadius: nome === foco ? 6 : 5,
            pointHoverRadius: nome === foco ? 6 : 5,
            pointBorderWidth: 0,
            datalabels: {
                display(contexto) {
                    return contexto.dataIndex === ultimoIndice;
                },
                formatter(valor) {
                    return formatarPercentual(valor);
                },
                color: nome === foco ? CORES.azulEscuro : estilo.cor,
                backgroundColor: nome === foco ? CORES.azulClaro : "#ffffff",
                borderColor: nome === foco ? CORES.azulClaro : estilo.cor,
                borderWidth: nome === foco ? 0 : 1,
                borderRadius: 9,
                padding: nome === foco ? 8 : 6,
                anchor: "center",
                align: "left",
                offset: nome === foco ? 14 : 10,
                clip: false,
                font: {
                    family: '"Segoe UI", Arial, Helvetica, sans-serif',
                    size: TIPOGRAFIA_GRAFICOS.valor,
                    weight: TIPOGRAFIA_GRAFICOS.peso
                }
            }
        };
    });

    return new window.Chart(canvas, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            events: [],
            layout: {
                padding: { top: 26, right: 20, bottom: 4, left: 10 }
            },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        color: "#53697c",
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 7,
                        padding: 10,
                        font: {
                            family: '"Segoe UI", Arial, Helvetica, sans-serif',
                            size: TIPOGRAFIA_GRAFICOS.eixo,
                            weight: TIPOGRAFIA_GRAFICOS.peso
                        }
                    }
                },
                y: {
                    display: true,
                    grace: "12%",
                    grid: {
                        display: true,
                        color: CORES.grade,
                        lineWidth: 1
                    },
                    border: { display: false },
                    ticks: { display: false }
                }
            }
        }
    });
}

function atualizarCartoes(dados, anterior, atual) {
    const plaAnterior = calcularPla(anterior);
    const plaAtual = calcularPla(atual);
    const variacao = plaAtual - plaAnterior;

    const campos = [
        ["plaPeriodoAnterior", rotuloPeriodo(anterior)],
        ["plaValorAnterior", formatarPercentual(plaAnterior)],
        ["plaForaAnterior", formatarInteiro(anterior?.foraPrazo)],
        ["plaNoPrazoAnterior", formatarInteiro(anterior?.noPrazo)],
        ["plaPeriodoAtual", rotuloPeriodo(atual)],
        ["plaValorAtual", formatarPercentual(plaAtual)],
        ["plaForaAtual", formatarInteiro(atual?.foraPrazo)],
        ["plaNoPrazoAtual", formatarInteiro(atual?.noPrazo)]
    ];

    campos.forEach(([id, valor]) => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = valor;
    });

    const variacaoEl = document.getElementById("plaVariacaoPontos");
    if (variacaoEl) {
        variacaoEl.textContent = formatarPontosPercentuais(variacao);
        variacaoEl.classList.remove("melhora", "piora");
        if (variacao < 0) variacaoEl.classList.add("melhora");
        if (variacao > 0) variacaoEl.classList.add("piora");
    }

    const fonteEl = document.getElementById("plaFonteStatus");
    if (fonteEl) {
        const exemplo = String(dados?.fonte || "").toLowerCase() === "exemplo";
        fonteEl.textContent = exemplo
            ? "Dados ilustrativos — substituir pelo JSON do Power Automate"
            : "Fonte: JSON gerado pelo Power Automate";
        fonteEl.classList.toggle("pla-fonte-exemplo", exemplo);
    }

    const statusEl = document.getElementById("plaStatusAtualizacao");
    if (statusEl) {
        statusEl.textContent = `Última atualização: ${formatarDataHora(dados?.atualizadoEm)}`;
    }
}

function renderizar(dados) {
    const apuracoes = ordenarApuracoes(dados?.apuracoes);
    if (apuracoes.length < 2) {
        exibirErro("PLA-V1: o JSON precisa conter pelo menos duas apurações.");
        return;
    }

    const anterior = apuracoes[apuracoes.length - 2];
    const atual = apuracoes[apuracoes.length - 1];
    const movimentacoes = prepararMovimentacoes(dados, anterior, atual);

    atualizarCartoes(dados, anterior, atual);
    limparGraficos();
    registrarDatalabels();

    try {
        const serieNoPrazo = construirSerieMovimentos(anterior, atual, movimentacoes, "noPrazo");
        graficoNoPrazo = criarGraficoMovimentacao(
            "plaGraficoNoPrazo",
            serieNoPrazo,
            "noPrazo",
            CORES.azul
        );
    } catch (erro) {
        console.warn("PLA-V1: falha no gráfico No Prazo.", erro);
    }

    try {
        const serieForaPrazo = construirSerieMovimentos(anterior, atual, movimentacoes, "foraPrazo");
        graficoForaPrazo = criarGraficoMovimentacao(
            "plaGraficoForaPrazo",
            serieForaPrazo,
            "foraPrazo",
            CORES.vermelho
        );
    } catch (erro) {
        console.warn("PLA-V1: falha no gráfico Fora Prazo.", erro);
    }

    try {
        graficoRegionais = criarGraficoRegional(dados);
    } catch (erro) {
        console.warn("PLA-V1: falha no gráfico regional.", erro);
    }

    exibirErro("");
}

async function carregarDados() {
    const separador = URL_DADOS.includes("?") ? "&" : "?";
    const url = `${URL_DADOS}${separador}_=${Date.now()}`;

    try {
        const resposta = await fetch(url, { cache: "no-store" });
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        const dados = await resposta.json();
        dadosValidos = dados;
        renderizar(dadosValidos);
    } catch (erro) {
        console.warn("PLA-V1: falha ao carregar dados.", erro);
        if (dadosValidos) {
            renderizar(dadosValidos);
            exibirErro("Falha na atualização; mantendo a última informação válida.");
        } else {
            exibirErro("Não foi possível carregar os dados do PLA.");
        }
    }
}

function atualizarCabecalho() {
    window.PAINEL_BASE?.definirCabecalho({
        titulo: "PLA",
        subtitulo: "Percentual de ligações atrasadas",
        contexto: "REGIONAL METROPOLITANA"
    });
}

function atualizarRelogio() {
    const contador = document.getElementById("contador");
    const barra = document.getElementById("barraTempo");
    if (contador) contador.textContent = `${segundosRestantes}s`;
    if (barra) barra.style.width = `${Math.max(0, (segundosRestantes / TEMPO_VISAO) * 100)}%`;
}

function concluirCiclo() {
    if (!cicloAtivo) return;
    cicloAtivo = false;
    clearInterval(temporizadorRotacao);
    clearInterval(temporizadorAtualizacao);
    temporizadorRotacao = null;
    temporizadorAtualizacao = null;

    const resolver = resolverCiclo;
    resolverCiclo = null;
    if (resolver) resolver();
}

function iniciarTemporizadores() {
    segundosRestantes = TEMPO_VISAO;
    atualizarRelogio();

    clearInterval(temporizadorRotacao);
    temporizadorRotacao = setInterval(() => {
        if (pausado || !cicloAtivo) return;
        segundosRestantes -= 1;
        atualizarRelogio();
        if (segundosRestantes <= 0) concluirCiclo();
    }, 1000);

    clearInterval(temporizadorAtualizacao);
    temporizadorAtualizacao = setInterval(() => {
        if (!cicloAtivo) return;
        carregarDados();
    }, TEMPO_ATUALIZACAO_DADOS);
}

export async function iniciar() {
    atualizarCabecalho();
    cicloAtivo = true;
    pausado = false;
    segundosRestantes = TEMPO_VISAO;

    await carregarDados();

    return new Promise(resolve => {
        resolverCiclo = resolve;
        iniciarTemporizadores();
    });
}

export function destruir() {
    clearInterval(temporizadorRotacao);
    clearInterval(temporizadorAtualizacao);
    temporizadorRotacao = null;
    temporizadorAtualizacao = null;
    limparGraficos();
    cicloAtivo = false;
    pausado = false;

    if (resolverCiclo) {
        const resolver = resolverCiclo;
        resolverCiclo = null;
        resolver();
    }
}

export function avancarSubvisao() {
    concluirCiclo();
}

export function voltarSubvisao() {
    segundosRestantes = TEMPO_VISAO;
    atualizarRelogio();
}

export function alternarPausa() {
    pausado = !pausado;
    return pausado;
}
