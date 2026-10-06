/* ================================================================
   PAINEL DE ACOMPANHAMENTO — PG-V2
   Player central: shell único + fragmentos modulares
   ================================================================ */

(function () {

    const config = window.PAINEL_CONFIG || {};
    const visoesConfiguradas = Array.isArray(config.visoes)
        ? config.visoes
        : [];

    // Uma visão só é excluída quando `ativo` for explicitamente false.
    // Assim, registros antigos sem essa propriedade continuam compatíveis.
    const visoes = visoesConfiguradas.filter(
        visao => visao?.ativo !== false
    );

    const slot = document.getElementById("conteudoVisao");
    const erroPlayer = document.getElementById("erroPlayer");

    const transicaoMs =
        Number(config.transicoes?.visaoMs) || 420;

    const timeoutSegurancaMs =
        Number(config.player?.timeoutSegurancaMs) || 300000;

    let moduloAtual = null;
    let cssAtual = null;
    let indiceAtual = -1;
    let tokenCiclo = Date.now();
    let primeiraExibicao = true;

    const modoDesenvolvimento =
        new URLSearchParams(window.location.search)
            .get("dev") === "1";

    function tratarAtalhoDesenvolvimento(evento) {
        if (!modoDesenvolvimento || !moduloAtual) return;
        if (evento.repeat) return;

        const alvo = evento.target;
        const tag = alvo?.tagName?.toLowerCase();

        if (
            tag === "input" ||
            tag === "textarea" ||
            tag === "select" ||
            alvo?.isContentEditable
        ) {
            return;
        }

        let nomeFuncao = null;

        if (evento.key === "ArrowRight") {
            nomeFuncao = "avancarSubvisao";
        }
        else if (evento.key === "ArrowLeft") {
            nomeFuncao = "voltarSubvisao";
        }
        else if (
            evento.key === " " ||
            evento.code === "Space"
        ) {
            nomeFuncao = "alternarPausa";
        }

        if (!nomeFuncao) return;

        const acao = moduloAtual[nomeFuncao];

        if (typeof acao !== "function") return;

        evento.preventDefault();
        acao();
    }

    if (modoDesenvolvimento) {
        document.addEventListener(
            "keydown",
            tratarAtalhoDesenvolvimento
        );
    }

    function urlSemCache(caminho) {
        const url = new URL(caminho, document.baseURI);
        url.searchParams.set("_ciclo", tokenCiclo);
        return url.href;
    }

    function mostrarErro(mensagem) {
        console.error(mensagem);
        if (!erroPlayer) return;
        erroPlayer.textContent = mensagem;
        erroPlayer.style.display = "block";
    }

    function limparErro() {
        if (!erroPlayer) return;
        erroPlayer.textContent = "";
        erroPlayer.style.display = "none";
    }

    async function carregarCss(caminho) {
        if (!caminho) return;

        const novoLink = document.createElement("link");
        novoLink.rel = "stylesheet";
        novoLink.href = urlSemCache(caminho);
        novoLink.dataset.painelVisao = "true";

        const carregou = new Promise((resolve, reject) => {
            novoLink.addEventListener("load", resolve, { once: true });
            novoLink.addEventListener("error", () => reject(
                new Error(`Falha ao carregar CSS: ${caminho}`)
            ), { once: true });
        });

        document.head.appendChild(novoLink);
        await carregou;

        if (cssAtual && cssAtual !== novoLink) {
            cssAtual.remove();
        }

        cssAtual = novoLink;
    }

    async function carregarFragmento(caminho) {
        const resposta = await fetch(
            urlSemCache(caminho),
            { cache: "no-store" }
        );

        if (!resposta.ok) {
            throw new Error(
                `Falha HTTP ${resposta.status} ao carregar ${caminho}`
            );
        }

        return resposta.text();
    }

    function definirCabecalho(visao) {
        window.PAINEL_BASE?.definirCabecalho({
            titulo: visao.titulo || visao.nome,
            subtitulo: visao.subtitulo || "Painel de Acompanhamento",
            contexto: "CARREGANDO"
        });

        const contador = document.getElementById("contador");
        const barra = document.getElementById("barraTempo");

        if (contador) contador.textContent = "";
        if (barra) barra.style.width = "100%";
    }

    async function trocarConteudo(visao) {
        const stage = document.getElementById("stage");

        // Na primeira carga não existe uma visão anterior para desaparecer.
        // Portanto, não aplicamos o atraso de transição: carregamos a primeira
        // visão e a revelamos diretamente quando fragmento + CSS estiverem prontos.
        if (!primeiraExibicao) {
            slot.classList.add("trocando-visao");
            await window.PAINEL_BASE.esperar(transicaoMs);
        }

        const [html] = await Promise.all([
            carregarFragmento(visao.fragmento),
            carregarCss(visao.css)
        ]);

        slot.innerHTML = html;
        slot.dataset.visao = visao.id;
        stage?.setAttribute("data-visao", visao.id);

        definirCabecalho(visao);

        // Garante layout antes da exibição.
        void slot.offsetWidth;
        slot.classList.remove("trocando-visao");

        if (primeiraExibicao) {
            primeiraExibicao = false;
            stage?.classList.remove("painel-iniciando");
        }
    }

    function comTimeout(promessa, ms, idVisao) {
        let timeoutId;

        const timeout = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(
                    `Timeout de segurança atingido na visão ${idVisao}.`
                ));
            }, ms);
        });

        return Promise.race([promessa, timeout])
            .finally(() => clearTimeout(timeoutId));
    }

    async function destruirModuloAtual() {
        if (!moduloAtual) return;

        try {
            if (typeof moduloAtual.destruir === "function") {
                await moduloAtual.destruir();
            }
        } catch (erro) {
            console.warn("Falha ao destruir módulo da visão anterior:", erro);
        } finally {
            moduloAtual = null;
        }
    }

    async function executarVisao(visao, indice) {
        indiceAtual = indice;
        limparErro();

        await destruirModuloAtual();
        await trocarConteudo(visao);

        const moduloUrl = urlSemCache(visao.modulo);
        moduloAtual = await import(moduloUrl);

        if (typeof moduloAtual.iniciar !== "function") {
            throw new Error(
                `O módulo ${visao.modulo} não exporta iniciar().`
            );
        }

        await comTimeout(
            Promise.resolve(
                moduloAtual.iniciar({
                    id: visao.id,
                    indice,
                    total: visoes.length
                })
            ),
            timeoutSegurancaMs,
            visao.id
        );
    }

    function recarregarAplicacao() {
        const url = new URL(window.location.href);
        url.searchParams.set("_ciclo", Date.now());
        window.location.replace(url.toString());
    }

    async function executarPainel() {
        if (!slot) {
            throw new Error("#conteudoVisao não encontrado no index.html.");
        }

        if (visoes.length === 0) {
            mostrarErro("Nenhuma visão foi configurada no PG-V2.");
            return;
        }

        tokenCiclo = Date.now();

        for (let i = 0; i < visoes.length; i++) {
            const visao = visoes[i];

            try {
                await executarVisao(visao, i);
            } catch (erro) {
                mostrarErro(
                    `A visão ${visao.id} apresentou erro e será ignorada neste ciclo.`
                );
                console.error(erro);
                await window.PAINEL_BASE.esperar(2500);
            }
        }

        await destruirModuloAtual();

        if (config.player?.recarregarAoFimDoCiclo !== false) {
            recarregarAplicacao();
            return;
        }

        // Fallback de desenvolvimento: repete sem reload.
        executarPainel();
    }

    async function iniciar() {
        try {
            await executarPainel();
        } catch (erro) {
            mostrarErro("Falha crítica no player do painel.");
            console.error(erro);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }

})();
