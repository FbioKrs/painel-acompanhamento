/* ================================================================
   TRATAMENTO DE DEMANDAS — DEM-V1
   Fonte: dados/base_reclamacoes.json
   ================================================================ */

const ID_VISAO = "DEM-V1";
const URL_DADOS = "./dados/base_reclamacoes.json";
const LIMITE_RESPONSAVEIS_POR_TELA = 7;

const TEMPO_PADRAO_VISAO =
    Number(window.PAINEL_CONFIG?.player?.tempoPadraoSegundos) || 15;

const TEMPO_ATUALIZACAO_DADOS =
    Number(window.PAINEL_CONFIG?.atualizacao?.intervaloPadraoMs) || 60000;

const DURACAO_TRANSICAO_CONTEUDO =
    Number(window.PAINEL_CONFIG?.transicoes?.conteudoMs) || 230;

let dadosGlobais = [];
let visoes = [{ tipo: "geral", chave: "geral", nome: "VISÃO GERAL" }];
let indiceVisaoAtual = 0;
let duracaoTelaAtual = TEMPO_PADRAO_VISAO;
let segundosRestantes = duracaoTelaAtual;
let temporizadorRotacao = null;
let temporizadorAtualizacao = null;
let resolverCiclo = null;
let cicloAtivo = false;
let pausado = false;

function numero(valor) {
    if (valor === null || valor === undefined || valor === "") return 0;

    if (typeof valor === "number") {
        return Number.isFinite(valor) ? Math.max(0, valor) : 0;
    }

    const texto = String(valor)
        .trim()
        .replace(/\./g, "")
        .replace(",", ".");

    const resultado = Number(texto);
    return Number.isFinite(resultado) ? Math.max(0, resultado) : 0;
}

function texto(valor) {
    return valor === null || valor === undefined
        ? ""
        : String(valor).trim();
}

function escaparHtml(valor) {
    return texto(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizarRegistro(registro, indice) {
    return {
        indice,
        categoria: texto(registro?.Categoria ?? registro?.categoria),
        responsavel: texto(
            registro?.["Responsável"]
            ?? registro?.Responsavel
            ?? registro?.responsavel
        ),
        vencidas: numero(registro?.Vencidas ?? registro?.vencidas),
        hoje: numero(registro?.Hoje ?? registro?.hoje),
        amanha: numero(
            registro?.["Amanhã"]
            ?? registro?.Amanha
            ?? registro?.amanha
        ),
        noPrazo: numero(
            registro?.["No Prazo"]
            ?? registro?.NoPrazo
            ?? registro?.noPrazo
        )
    };
}

function totalRegistro(registro) {
    return registro.vencidas + registro.hoje + registro.amanha + registro.noPrazo;
}

function somar(registros, campo) {
    return registros.reduce((soma, item) => soma + numero(item?.[campo]), 0);
}

function plural(valor, singular, pluralizado) {
    return `${valor} ${valor === 1 ? singular : pluralizado}`;
}

function contarResponsaveis(registros, campo) {
    return new Set(
        registros
            .filter(item => numero(item?.[campo]) > 0 && item.responsavel)
            .map(item => item.responsavel.toLocaleUpperCase("pt-BR"))
    ).size;
}

function obterCategorias() {
    const nomes = [];
    const vistos = new Set();

    for (const registro of dadosGlobais) {
        const chave = registro.categoria.toLocaleUpperCase("pt-BR");
        if (!registro.categoria || vistos.has(chave)) continue;
        vistos.add(chave);
        nomes.push(registro.categoria);
    }

    return nomes;
}

function registrosDaCategoria(categoria) {
    const chave = categoria.toLocaleUpperCase("pt-BR");

    return dadosGlobais
        .filter(item => item.categoria.toLocaleUpperCase("pt-BR") === chave)
        .slice()
        .sort((a, b) =>
            b.vencidas - a.vencidas
            || b.hoje - a.hoje
            || b.amanha - a.amanha
            || totalRegistro(b) - totalRegistro(a)
            || a.responsavel.localeCompare(b.responsavel, "pt-BR")
        );
}

function dividirEmPaginas(lista, tamanho) {
    const paginas = [];

    for (let i = 0; i < lista.length; i += tamanho) {
        paginas.push(lista.slice(i, i + tamanho));
    }

    return paginas.length > 0 ? paginas : [[]];
}

function chaveCategoria(categoria) {
    return categoria
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function atualizarListaVisoes() {
    const novaLista = [
        { tipo: "geral", chave: "geral", nome: "VISÃO GERAL" }
    ];

    for (const categoria of obterCategorias()) {
        const registros = registrosDaCategoria(categoria);
        const paginas = dividirEmPaginas(
            registros,
            LIMITE_RESPONSAVEIS_POR_TELA
        );

        paginas.forEach((itens, indicePagina) => {
            const totalPaginas = paginas.length;
            const sufixo = totalPaginas > 1
                ? ` • ${indicePagina + 1}/${totalPaginas}`
                : "";

            novaLista.push({
                tipo: "detalhe",
                chave: `detalhe:${chaveCategoria(categoria)}:${indicePagina + 1}`,
                categoria,
                nome: `${categoria}${sufixo}`,
                pagina: indicePagina + 1,
                totalPaginas,
                registros: itens
            });
        });
    }

    const atual = visoes[indiceVisaoAtual];
    const chaveAtual = atual?.chave;

    visoes = novaLista;

    if (chaveAtual) {
        const novoIndice = visoes.findIndex(item => item.chave === chaveAtual);
        indiceVisaoAtual = novoIndice >= 0
            ? novoIndice
            : Math.min(indiceVisaoAtual, visoes.length - 1);
    } else {
        indiceVisaoAtual = 0;
    }
}

function obterVisaoAtual() {
    return visoes[indiceVisaoAtual] || visoes[0];
}

function obterTempoVisaoAtual() {
    const visao = obterVisaoAtual();

    return (
        window.PAINEL_BASE?.obterTempoTela?.(
            ID_VISAO,
            visao?.chave,
            visao?.tipo
        )
        || TEMPO_PADRAO_VISAO
    );
}

function reiniciarContagemVisaoAtual() {
    duracaoTelaAtual = obterTempoVisaoAtual();
    segundosRestantes = duracaoTelaAtual;
}

function atualizarContador() {
    const contador = document.getElementById("contador");
    const barra = document.getElementById("barraTempo");

    if (!contador || !barra) return;

    contador.textContent = `${segundosRestantes}s`;

    const percentual = duracaoTelaAtual > 0
        ? Math.max(0, (segundosRestantes / duracaoTelaAtual) * 100)
        : 0;

    barra.style.width = `${percentual}%`;
}

function pararRotacao() {
    if (!temporizadorRotacao) return;
    clearInterval(temporizadorRotacao);
    temporizadorRotacao = null;
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

function definirTexto(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = valor;
}

function atualizarAlerta(elemento, titulo, detalhe, possuiAlerta) {
    if (!elemento) return;
    elemento.classList.toggle("sem-alerta", !possuiAlerta);

    const icone = elemento.querySelector(".dem-alerta-icone");
    const tag = elemento.querySelector(".dem-alerta-tag");

    if (icone) icone.textContent = possuiAlerta ? "!" : "✓";
    if (tag && !possuiAlerta) tag.textContent = "SEM ALERTA";

    const tituloEl = elemento.querySelector(".dem-alerta-texto strong");
    const detalheEl = elemento.querySelector(".dem-alerta-texto span");

    if (tituloEl) tituloEl.textContent = titulo;
    if (detalheEl) detalheEl.textContent = detalhe;
}

function percentual(parte, total) {
    if (!total) return 0;
    return Math.max(0, Math.min(100, (parte / total) * 100));
}

function renderizarGeral() {
    const totalVencidas = somar(dadosGlobais, "vencidas");
    const totalHoje = somar(dadosGlobais, "hoje");
    const totalAmanha = somar(dadosGlobais, "amanha");
    const totalPrazo = somar(dadosGlobais, "noPrazo");
    const totalDemandas = totalVencidas + totalHoje + totalAmanha + totalPrazo;

    definirTexto("demGeralVencidas", totalVencidas);
    definirTexto("demGeralHoje", totalHoje);
    definirTexto("demGeralAmanha", totalAmanha);
    definirTexto("demGeralPrazo", totalPrazo);

    definirTexto(
        "demGeralVencidasInfo",
        plural(contarResponsaveis(dadosGlobais, "vencidas"), "responsável", "responsáveis")
    );
    definirTexto(
        "demGeralHojeInfo",
        plural(contarResponsaveis(dadosGlobais, "hoje"), "responsável", "responsáveis")
    );
    definirTexto(
        "demGeralAmanhaInfo",
        plural(contarResponsaveis(dadosGlobais, "amanha"), "responsável", "responsáveis")
    );
    definirTexto(
        "demGeralPrazoInfo",
        plural(contarResponsaveis(dadosGlobais, "noPrazo"), "responsável", "responsáveis")
    );

    const categoriasComHoje = obterCategorias().filter(categoria =>
        somar(registrosDaCategoria(categoria), "hoje") > 0
    ).length;

    atualizarAlerta(
        document.getElementById("demAlertaGeral"),
        totalHoje > 0
            ? `${plural(totalHoje, "demanda vence", "demandas vencem")} hoje`
            : "Nenhuma demanda vence hoje",
        totalHoje > 0
            ? `${plural(contarResponsaveis(dadosGlobais, "hoje"), "responsável precisa", "responsáveis precisam")} atuar em ${plural(categoriasComHoje, "categoria", "categorias")}.`
            : "Sem alertas de vencimento para o dia atual.",
        totalHoje > 0
    );

    const tag = document.querySelector("#demAlertaGeral .dem-alerta-tag");
    if (tag && totalHoje > 0) tag.textContent = "AÇÃO HOJE";

    definirTexto(
        "demResumoTotal",
        `${plural(totalDemandas, "demanda", "demandas")} no total`
    );

    const container = document.getElementById("demCategorias");
    if (!container) return;

    const categorias = obterCategorias();

    container.style.gridTemplateColumns =
        categorias.length <= 1
            ? "minmax(0, 1fr)"
            : categorias.length === 2
                ? "repeat(2, minmax(0, 1fr))"
                : "repeat(3, minmax(0, 1fr))";

    container.innerHTML = categorias.map(categoria => {
        const registros = registrosDaCategoria(categoria);
        const vencidas = somar(registros, "vencidas");
        const hoje = somar(registros, "hoje");
        const amanha = somar(registros, "amanha");
        const noPrazo = somar(registros, "noPrazo");
        const total = vencidas + hoje + amanha + noPrazo;
        const responsaveis = registros.length;

        return `
            <article class="dem-categoria-card">
                <div class="dem-categoria-topo">
                    <div class="dem-categoria-nome">
                        <strong>${escaparHtml(categoria)}</strong>
                        <span>${plural(responsaveis, "responsável", "responsáveis")}</span>
                    </div>
                    <div class="dem-categoria-total">
                        <strong>${total}</strong>
                        <span>Total</span>
                    </div>
                </div>

                <div class="dem-categoria-metricas">
                    <div class="dem-categoria-metrica">
                        <span>Vencidas</span>
                        <strong class="dem-cor-vencidas">${vencidas}</strong>
                    </div>
                    <div class="dem-categoria-metrica">
                        <span>Hoje</span>
                        <strong class="dem-cor-hoje">${hoje}</strong>
                    </div>
                    <div class="dem-categoria-metrica">
                        <span>Amanhã</span>
                        <strong class="dem-cor-amanha">${amanha}</strong>
                    </div>
                    <div class="dem-categoria-metrica">
                        <span>No Prazo</span>
                        <strong class="dem-cor-prazo">${noPrazo}</strong>
                    </div>
                </div>

                <div class="dem-categoria-barra" aria-hidden="true">
                    <span class="dem-seg-vencidas" style="width:${percentual(vencidas, total)}%"></span>
                    <span class="dem-seg-hoje" style="width:${percentual(hoje, total)}%"></span>
                    <span class="dem-seg-amanha" style="width:${percentual(amanha, total)}%"></span>
                    <span class="dem-seg-prazo" style="width:${percentual(noPrazo, total)}%"></span>
                </div>
            </article>
        `;
    }).join("");
}

function celulaNumero(valor, classe, hoje = false) {
    const numeroValor = numero(valor);

    if (numeroValor <= 0) {
        return '<span class="dem-numero-zero">0</span>';
    }

    if (hoje) {
        return `<span class="dem-badge-hoje">${numeroValor}</span>`;
    }

    return `<span class="dem-numero ${classe}">${numeroValor}</span>`;
}

function renderizarDetalhe(visao) {
    const todos = registrosDaCategoria(visao.categoria);
    const vencidas = somar(todos, "vencidas");
    const hoje = somar(todos, "hoje");
    const amanha = somar(todos, "amanha");
    const noPrazo = somar(todos, "noPrazo");
    const total = vencidas + hoje + amanha + noPrazo;
    const responsaveisHoje = contarResponsaveis(todos, "hoje");

    definirTexto("demDetalheVencidas", vencidas);
    definirTexto("demDetalheHoje", hoje);
    definirTexto("demDetalheAmanha", amanha);
    definirTexto("demDetalhePrazo", noPrazo);
    definirTexto(
        "demDetalheHojeInfo",
        plural(responsaveisHoje, "responsável", "responsáveis")
    );
    definirTexto(
        "demDetalhePrazoInfo",
        `${Math.round(percentual(noPrazo, total))}% da categoria`
    );

    const alerta = document.getElementById("demAlertaDetalhe");
    atualizarAlerta(
        alerta,
        hoje > 0
            ? `${plural(hoje, "demanda vence", "demandas vencem")} hoje em ${visao.categoria}`
            : `Nenhuma demanda vence hoje em ${visao.categoria}`,
        hoje > 0
            ? `${plural(responsaveisHoje, "responsável precisa", "responsáveis precisam")} atuar antes do encerramento do dia.`
            : "Sem alertas de vencimento para esta categoria.",
        hoje > 0
    );

    const tag = document.getElementById("demAlertaDetalheTag");
    if (tag) tag.textContent = hoje > 0
        ? visao.categoria.toLocaleUpperCase("pt-BR")
        : "SEM ALERTA";

    definirTexto(
        "demDetalhePaginacao",
        visao.totalPaginas > 1
            ? `Página ${visao.pagina} de ${visao.totalPaginas} • ${todos.length} responsáveis`
            : `${plural(todos.length, "responsável", "responsáveis")}`
    );

    const corpo = document.getElementById("demTabelaCorpo");
    if (!corpo) return;

    corpo.innerHTML = visao.registros.map(registro => `
        <tr>
            <td class="dem-responsavel" title="${escaparHtml(registro.responsavel)}">${escaparHtml(registro.responsavel)}</td>
            <td>${celulaNumero(registro.vencidas, "dem-cor-vencidas")}</td>
            <td>${celulaNumero(registro.hoje, "", true)}</td>
            <td>${celulaNumero(registro.amanha, "dem-cor-amanha")}</td>
            <td>${celulaNumero(registro.noPrazo, "dem-cor-prazo")}</td>
            <td class="dem-total-linha">${totalRegistro(registro)}</td>
        </tr>
    `).join("");
}

function renderizarVisao() {
    const visao = obterVisaoAtual();
    const geral = document.getElementById("demSubvisaoGeral");
    const detalhe = document.getElementById("demSubvisaoDetalhe");
    const nomeHeader = document.getElementById("nomeVisaoHeader");

    if (!geral || !detalhe || !nomeHeader) return;

    const ehGeral = visao.tipo === "geral";

    geral.classList.toggle("ativa", ehGeral);
    geral.setAttribute("aria-hidden", ehGeral ? "false" : "true");
    detalhe.classList.toggle("ativa", !ehGeral);
    detalhe.setAttribute("aria-hidden", ehGeral ? "true" : "false");

    nomeHeader.textContent = visao.nome;

    if (ehGeral) {
        renderizarGeral();
    } else {
        renderizarDetalhe(visao);
    }

    atualizarContador();
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

function avancarVisao() {
    if (!cicloAtivo) return;

    const proximoIndice = indiceVisaoAtual + 1;

    if (proximoIndice >= visoes.length) {
        concluirCiclo();
        return;
    }

    indiceVisaoAtual = proximoIndice;
    reiniciarContagemVisaoAtual();
    trocarVisaoComTransicao();
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

function extrairListaDados(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.dados)) return payload.dados;
    return null;
}

async function carregarDados() {
    const erro = document.getElementById("erroDemandas");

    try {
        const resposta = await fetch(
            `${URL_DADOS}?t=${Date.now()}`,
            { cache: "no-store" }
        );

        if (!resposta.ok) {
            throw new Error(`Erro HTTP ${resposta.status}`);
        }

        const payload = await resposta.json();
        const lista = extrairListaDados(payload);

        if (!Array.isArray(lista)) {
            throw new Error("base_reclamacoes.json deve conter uma lista de registros.");
        }

        const normalizados = lista
            .map(normalizarRegistro)
            .filter(item => item.categoria && item.responsavel);

        if (normalizados.length === 0) {
            throw new Error("Nenhuma demanda válida foi encontrada em base_reclamacoes.json.");
        }

        dadosGlobais = normalizados;
        atualizarListaVisoes();
        renderizarVisao();

        if (erro) {
            erro.style.display = "none";
            erro.textContent = "";
        }
    } catch (falha) {
        console.error("Erro ao carregar demandas:", falha);

        if (erro) {
            erro.style.display = "block";
            erro.textContent =
                "Não foi possível atualizar as demandas. A última informação válida continuará sendo exibida.";
        }

        if (dadosGlobais.length > 0) {
            renderizarVisao();
        }
    }
}

export async function iniciar() {
    indiceVisaoAtual = 0;
    cicloAtivo = true;
    pausado = false;

    await carregarDados();

    if (dadosGlobais.length === 0) {
        concluirCiclo();
        return;
    }

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
    if (!cicloAtivo || indiceVisaoAtual <= 0) return;

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
