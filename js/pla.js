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

const REGIONAIS_PREFERENCIA = Object.freeze([
    "METROPOLITANA",
    "PARNAIBA",
    "PICOS",
    "FLORIANO"
]);

const NOMES_REGIONAIS = Object.freeze({
    METROPOLITANA: "Metropolitana",
    PARNAIBA: "Parnaíba",
    PICOS: "Picos",
    FLORIANO: "Floriano"
});

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

function numeroValido(valor) {
    if (valor === null || valor === undefined || valor === "") return false;
    if (typeof valor === "number") return Number.isFinite(valor);

    const texto = String(valor).trim();
    const normalizado = texto.includes(",")
        ? texto.replace(/\./g, "").replace(",", ".")
        : texto;
    return Number.isFinite(Number(normalizado));
}

function validarDados(dados) {
    const comparativo = Array.isArray(dados?.comparativo) ? dados.comparativo : [];
    if (comparativo.length < 2) {
        return "comparativo precisa conter pelo menos as referências Anterior e Atual";
    }

    for (const item of comparativo) {
        for (const campo of ["PLA", "FORA PRAZO", "NO PRAZO", "ORDEM"]) {
            if (!numeroValido(item?.[campo])) {
                return `comparativo.${campo} precisa ser numérico`;
            }
        }
        if (!String(item?.ROTULO || item?.REFERENCIA || "").trim()) {
            return "comparativo precisa informar ROTULO ou REFERENCIA";
        }
    }

    const movimentacoes = Array.isArray(dados?.movimentacoes) ? dados.movimentacoes : [];
    if (movimentacoes.length < 2) {
        return "movimentacoes precisa conter os pontos Anterior, eventos e Atual";
    }

    const movimentacoesOrdenadas = ordenarMovimentacoes(movimentacoes);
    const ultimoIndice = movimentacoesOrdenadas.length - 1;

    for (const [indice, item] of movimentacoesOrdenadas.entries()) {
        if (!numeroValido(item?.ORDEM) || !String(item?.EVENTO || "").trim()) {
            return "cada movimentação precisa informar ORDEM e EVENTO";
        }
        for (const campo of ["SALDO_NO_PRAZO", "SALDO_FORA_PRAZO"]) {
            if (!numeroValido(item?.[campo])) {
                return `movimentacoes.${item?.EVENTO || item?.ORDEM}.${campo} precisa ser numérico`;
            }
        }
        const extremo = indice === 0 || indice === ultimoIndice;
        for (const campo of ["MOV_NO_PRAZO", "MOV_FORA_PRAZO"]) {
            const valor = item?.[campo];
            if (!extremo && !numeroValido(valor)) {
                return `movimentacoes.${item?.EVENTO || item?.ORDEM}.${campo} precisa ser numérico`;
            }
            if (extremo && valor !== null && valor !== undefined && valor !== "" && !numeroValido(valor)) {
                return `movimentacoes.${item?.EVENTO || item?.ORDEM}.${campo} precisa ser nulo ou numérico`;
            }
        }
    }

    const historico = Array.isArray(dados?.historicoRegional) ? dados.historicoRegional : [];
    if (!historico.length) {
        return "historicoRegional precisa conter dados";
    }

    for (const item of historico) {
        if (!String(item?.REFERENCIA || "").trim() || !String(item?.REGIONAL || "").trim()) {
            return "historicoRegional precisa informar REFERENCIA e REGIONAL";
        }
        for (const campo of ["FORA PRAZO", "NO PRAZO", "PLA"]) {
            if (!numeroValido(item?.[campo])) {
                return `historicoRegional.${campo} precisa ser numérico`;
            }
        }
    }

    return "";
}

function formatarInteiro(valor) {
    return Math.round(numero(valor)).toLocaleString("pt-BR");
}

function formatarPercentual(valor) {
    return `${(numero(valor) * 100).toLocaleString("pt-BR", {
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


function ordenarMovimentacoes(movimentacoes) {
    return [...(Array.isArray(movimentacoes) ? movimentacoes : [])].sort(
        (a, b) => numero(a?.ORDEM) - numero(b?.ORDEM)
    );
}

function rotuloPeriodo(apuracao) {
    if (apuracao?.ROTULO) return String(apuracao.ROTULO);
    if (apuracao?.REFERENCIA) return rotuloData(apuracao.REFERENCIA);
    return "--";
}

function rotuloData(valor) {
    const texto = String(valor || "").trim();

    let match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) return `${match[1]}/${match[2]}`;

    match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}`;

    return texto;
}

function chaveRegional(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();
}

function nomeRegional(chave) {
    return NOMES_REGIONAIS[chave] || String(chave || "");
}

function timestampReferencia(valor) {
    const texto = String(valor || "").trim();
    let match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) return Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));

    match = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

    return Number.POSITIVE_INFINITY;
}

function ordenarComparativo(comparativo) {
    return [...(Array.isArray(comparativo) ? comparativo : [])].sort(
        (a, b) => numero(a?.ORDEM) - numero(b?.ORDEM)
    );
}

function numeroOuNull(valor) {
    return valor === null || valor === undefined || valor === "" ? null : numero(valor);
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

function prepararMovimentacoes(dados) {
    return ordenarMovimentacoes(dados?.movimentacoes).map(item => ({
        ordem: numero(item?.ORDEM),
        evento: String(item?.EVENTO || "Movimentação"),
        rotulo: String(item?.EVENTO || "Mov."),
        noPrazo: {
            movimentacao: numeroOuNull(item?.MOV_NO_PRAZO),
            saldo: numero(item?.SALDO_NO_PRAZO)
        },
        foraPrazo: {
            movimentacao: numeroOuNull(item?.MOV_FORA_PRAZO),
            saldo: numero(item?.SALDO_FORA_PRAZO)
        }
    }));
}

function construirSerieMovimentos(movimentacoes, campo) {
    const labels = [];
    const valores = [];
    const deltas = [];

    movimentacoes.forEach(item => {
        const detalhe = item?.[campo] || {};
        labels.push(item.rotulo);
        valores.push(numero(detalhe.saldo));
        deltas.push(detalhe.movimentacao === null ? null : numero(detalhe.movimentacao));
    });

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

function obterEstiloRegionalPorChave(chave, focoChave = "METROPOLITANA") {
    if (chave === focoChave) return ESTILOS_REGIONAIS[0];

    const alternativas = ESTILOS_REGIONAIS.slice(1);
    const preferenciaSemFoco = REGIONAIS_PREFERENCIA.filter(item => item !== focoChave);
    let indice = preferenciaSemFoco.indexOf(chave);

    if (indice < 0) {
        indice = Math.abs([...String(chave || "")].reduce((total, caractere) => total + caractere.charCodeAt(0), 0));
    }

    return alternativas[indice % alternativas.length];
}

function formatarDiferencaRanking(valor) {
    if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";

    const absoluto = Math.abs(valor).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    if (valor < 0) return `▼ -${absoluto} p.p.`;
    if (valor > 0) return `▲ +${absoluto} p.p.`;
    return `• ${absoluto} p.p.`;
}

function classeDiferencaRanking(valor) {
    if (valor === null || valor === undefined || !Number.isFinite(valor) || valor === 0) return "neutra";
    return valor < 0 ? "melhora" : "piora";
}

function criarSparklineRanking(valores, cor) {
    if (!Array.isArray(valores) || valores.length < 2) {
        const vazio = document.createElement("span");
        vazio.className = "pla-ranking-sem-historico";
        vazio.textContent = "—";
        return vazio;
    }

    const largura = 104;
    const altura = 30;
    const margem = 3;
    const minimo = Math.min(...valores);
    const maximo = Math.max(...valores);
    const amplitude = Math.max(maximo - minimo, 0.0001);
    const passo = (largura - margem * 2) / Math.max(1, valores.length - 1);

    const pontos = valores.map((valor, indice) => {
        const x = margem + indice * passo;
        const y = margem + ((maximo - valor) / amplitude) * (altura - margem * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", `0 0 ${largura} ${altura}`);
    svg.setAttribute("class", "pla-ranking-sparkline");
    svg.setAttribute("aria-hidden", "true");

    const linha = document.createElementNS(namespace, "polyline");
    linha.setAttribute("points", pontos);
    linha.setAttribute("fill", "none");
    linha.setAttribute("stroke", cor);
    linha.setAttribute("stroke-width", "2.4");
    linha.setAttribute("stroke-linecap", "round");
    linha.setAttribute("stroke-linejoin", "round");

    const listaPontos = pontos.split(" ");
    const ultimo = listaPontos[listaPontos.length - 1].split(",");
    const pontoFinal = document.createElementNS(namespace, "circle");
    pontoFinal.setAttribute("cx", ultimo[0]);
    pontoFinal.setAttribute("cy", ultimo[1]);
    pontoFinal.setAttribute("r", "2.8");
    pontoFinal.setAttribute("fill", cor);

    svg.appendChild(linha);
    svg.appendChild(pontoFinal);
    return svg;
}

function prepararRankingRegional(dados) {
    const historico = Array.isArray(dados?.historicoRegional) ? dados.historicoRegional : [];
    const validos = historico
        .map(item => ({
            ...item,
            chave: chaveRegional(item?.REGIONAL),
            referencia: String(item?.REFERENCIA || "").trim(),
            timestamp: timestampReferencia(item?.REFERENCIA),
            pla: numero(item?.PLA)
        }))
        .filter(item => item.chave && item.referencia && Number.isFinite(item.timestamp));

    if (!validos.length) return { referencia: "", itens: [] };

    const porReferencia = new Map();
    validos.forEach(item => {
        if (!porReferencia.has(item.referencia)) {
            porReferencia.set(item.referencia, {
                referencia: item.referencia,
                timestamp: item.timestamp,
                regionais: new Set()
            });
        }
        porReferencia.get(item.referencia).regionais.add(item.chave);
    });

    const referencias = [...porReferencia.values()].sort((a, b) => {
        const diferencaCobertura = b.regionais.size - a.regionais.size;
        if (diferencaCobertura !== 0) return diferencaCobertura;
        return b.timestamp - a.timestamp;
    });

    const referenciaRanking = referencias[0];
    const atuaisPorRegional = new Map();

    validos
        .filter(item => item.referencia === referenciaRanking.referencia)
        .forEach(item => atuaisPorRegional.set(item.chave, item));

    const focoChave = atuaisPorRegional.has("METROPOLITANA")
        ? "METROPOLITANA"
        : [...atuaisPorRegional.keys()][0];

    const itens = [...atuaisPorRegional.values()].map(atual => {
        const serie = validos
            .filter(item => item.chave === atual.chave && item.timestamp <= referenciaRanking.timestamp)
            .sort((a, b) => a.timestamp - b.timestamp);

        const anteriores = serie.filter(item => item.timestamp < referenciaRanking.timestamp);
        const anterior = anteriores.length ? anteriores[anteriores.length - 1] : null;
        const diferencaPp = anterior ? (atual.pla - anterior.pla) * 100 : null;
        const tendencia = serie.slice(-5).map(item => item.pla);

        return {
            chave: atual.chave,
            nome: nomeRegional(atual.chave),
            pla: atual.pla,
            diferencaPp,
            tendencia,
            foco: atual.chave === focoChave,
            estilo: obterEstiloRegionalPorChave(atual.chave, focoChave)
        };
    });

    itens.sort((a, b) => {
        if (a.pla !== b.pla) return a.pla - b.pla;
        return a.nome.localeCompare(b.nome, "pt-BR");
    });

    return { referencia: referenciaRanking.referencia, itens };
}

function renderizarRankingRegional(dados) {
    const corpo = document.getElementById("plaRankingCorpo");
    if (!corpo) return;
    corpo.innerHTML = "";

    const ranking = prepararRankingRegional(dados);
    const limite = Math.min(6, ranking.itens.length);

    ranking.itens.slice(0, limite).forEach((item, indice) => {
        const linha = document.createElement("tr");
        if (item.foco) linha.classList.add("pla-ranking-foco");
        linha.title = ranking.referencia ? `Referência: ${ranking.referencia}` : "";

        const posicao = document.createElement("td");
        posicao.className = "pla-ranking-posicao";
        posicao.textContent = `${indice + 1}º`;

        const regional = document.createElement("td");
        const regionalConteudo = document.createElement("div");
        regionalConteudo.className = "pla-ranking-regional";
        const marcador = document.createElement("span");
        marcador.className = `pla-ranking-marcador ${item.estilo.classe}`;
        marcador.style.color = item.estilo.cor;
        const nome = document.createElement("span");
        nome.className = "pla-ranking-regional-nome";
        nome.textContent = item.nome;
        regionalConteudo.appendChild(marcador);
        regionalConteudo.appendChild(nome);
        regional.appendChild(regionalConteudo);

        const pla = document.createElement("td");
        pla.className = "pla-ranking-pla";
        pla.textContent = formatarPercentual(item.pla);

        const diferenca = document.createElement("td");
        diferenca.className = `pla-ranking-diferenca ${classeDiferencaRanking(item.diferencaPp)}`;
        diferenca.textContent = formatarDiferencaRanking(item.diferencaPp);

        const tendencia = document.createElement("td");
        tendencia.className = "pla-ranking-tendencia";
        tendencia.appendChild(criarSparklineRanking(item.tendencia, item.estilo.cor));

        linha.appendChild(posicao);
        linha.appendChild(regional);
        linha.appendChild(pla);
        linha.appendChild(diferenca);
        linha.appendChild(tendencia);
        corpo.appendChild(linha);
    });
}

function criarGraficoRegional(dados) {
    const canvas = document.getElementById("plaGraficoRegionais");
    if (!canvas || !window.Chart) return null;

    const historico = Array.isArray(dados?.historicoRegional) ? dados.historicoRegional : [];
    const referencias = [...new Set(historico.map(item => String(item?.REFERENCIA || "").trim()).filter(Boolean))]
        .sort((a, b) => {
            const ta = timestampReferencia(a);
            const tb = timestampReferencia(b);
            if (ta !== tb) return ta - tb;
            return a.localeCompare(b, "pt-BR");
        });

    const chavesEncontradas = [...new Set(historico.map(item => chaveRegional(item?.REGIONAL)).filter(Boolean))];
    const chavesOrdenadas = [
        ...REGIONAIS_PREFERENCIA.filter(chave => chavesEncontradas.includes(chave)),
        ...chavesEncontradas.filter(chave => !REGIONAIS_PREFERENCIA.includes(chave))
    ];

    const focoChave = chavesOrdenadas.includes("METROPOLITANA")
        ? "METROPOLITANA"
        : chavesOrdenadas[0];
    const regionais = chavesOrdenadas.map(chave => nomeRegional(chave));
    const foco = nomeRegional(focoChave);

    criarLegendaRegionais(regionais, foco);

    const mapa = new Map();
    historico.forEach(item => {
        const referencia = String(item?.REFERENCIA || "").trim();
        const regional = chaveRegional(item?.REGIONAL);
        if (!referencia || !regional) return;
        mapa.set(`${referencia}||${regional}`, numero(item?.PLA));
    });

    const labels = referencias.map(rotuloData);
    const ordenadas = [
        ...chavesOrdenadas.filter(chave => chave === focoChave),
        ...chavesOrdenadas.filter(chave => chave !== focoChave)
    ];

    const datasets = ordenadas.map((chave, indice) => {
        const nome = nomeRegional(chave);
        const estilo = obterEstiloRegional(nome, Math.max(0, indice - 1), foco);
        const valores = referencias.map(referencia => {
            const valor = mapa.get(`${referencia}||${chave}`);
            return valor === undefined ? null : valor;
        });
        const ultimoIndice = valores.reduce(
            (ultimo, valor, indiceValor) => valor === null ? ultimo : indiceValor,
            -1
        );

        return {
            label: nome,
            data: valores,
            borderColor: estilo.cor,
            backgroundColor: estilo.cor,
            borderWidth: nome === foco ? 5 : 3,
            tension: 0.18,
            fill: false,
            spanGaps: false,
            pointStyle: estilo.pointStyle,
            pointRadius(contexto) {
                return contexto.raw === null ? 0 : (nome === foco ? 6 : 5);
            },
            pointHoverRadius: nome === foco ? 6 : 5,
            pointBorderWidth: 0,
            datalabels: {
                display(contexto) {
                    return ultimoIndice >= 0 && contexto.dataIndex === ultimoIndice && contexto.dataset.data[contexto.dataIndex] !== null;
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

function atualizarCartoes(anterior, atual, variacao) {
    const plaAnterior = numero(anterior?.PLA);
    const plaAtual = numero(atual?.PLA);

    const campos = [
        ["plaPeriodoAnterior", rotuloPeriodo(anterior)],
        ["plaValorAnterior", formatarPercentual(plaAnterior)],
        ["plaForaAnterior", formatarInteiro(anterior?.["FORA PRAZO"])],
        ["plaNoPrazoAnterior", formatarInteiro(anterior?.["NO PRAZO"])],
        ["plaPeriodoAtual", rotuloPeriodo(atual)],
        ["plaValorAtual", formatarPercentual(plaAtual)],
        ["plaForaAtual", formatarInteiro(atual?.["FORA PRAZO"])],
        ["plaNoPrazoAtual", formatarInteiro(atual?.["NO PRAZO"])]
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
}

function renderizar(dados) {
    const comparativo = ordenarComparativo(dados?.comparativo);
    const anterior = comparativo[0];
    const atual = comparativo[comparativo.length - 1];

    if (!anterior || !atual) {
        exibirErro("PLA-V1: estrutura de comparativo inválida.");
        return;
    }

    const movimentacoes = prepararMovimentacoes(dados);
    const variacao = (numero(atual?.PLA) - numero(anterior?.PLA)) * 100;

    atualizarCartoes(anterior, atual, variacao);
    renderizarRankingRegional(dados);
    limparGraficos();
    registrarDatalabels();

    try {
        const serieNoPrazo = construirSerieMovimentos(movimentacoes, "noPrazo");
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
        const serieForaPrazo = construirSerieMovimentos(movimentacoes, "foraPrazo");
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
        const erroEstrutura = validarDados(dados);
        if (erroEstrutura) throw new Error(`Estrutura inválida: ${erroEstrutura}`);
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
