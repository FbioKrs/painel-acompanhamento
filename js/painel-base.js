/* ================================================================
   PAINEL DE ACOMPANHAMENTO — PG-V2
   Comportamentos compartilhados do shell único
   ================================================================ */

(function () {

    const config = window.PAINEL_CONFIG || {};

    function ajustarTela() {
        const stage = document.getElementById("stage");
        if (!stage) return;

        const larguraBase = Number(config.tela?.largura) || 1920;
        const alturaBase = Number(config.tela?.altura) || 1080;

        const escala = Math.min(
            window.innerWidth / larguraBase,
            window.innerHeight / alturaBase
        );

        stage.style.transform =
            `translate(-50%, -50%) scale(${escala})`;
    }

    function esperar(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function definirCabecalho({ titulo, subtitulo, contexto } = {}) {
        const tituloEl = document.getElementById("tituloPrincipal");
        const subtituloEl = document.getElementById("subtituloPrincipal");
        const contextoEl = document.getElementById("nomeVisaoHeader");

        if (tituloEl && titulo) tituloEl.textContent = titulo;
        if (subtituloEl && subtitulo) subtituloEl.textContent = subtitulo;
        if (contextoEl && contexto) contextoEl.textContent = contexto;
    }


    function numeroPositivo(valor) {
        const numero = Number(valor);
        return Number.isFinite(numero) && numero > 0
            ? numero
            : null;
    }

    function obterTempoTela(idVisao, ...chaves) {
        const tempoGlobal =
            numeroPositivo(config.player?.tempoPadraoSegundos)
            || 15;

        const visao = Array.isArray(config.visoes)
            ? config.visoes.find(item => item?.id === idVisao)
            : null;

        const tempos = visao?.tempos;

        if (!tempos || typeof tempos !== "object") {
            return tempoGlobal;
        }

        for (const chave of chaves) {
            if (!chave) continue;

            const tempo = numeroPositivo(tempos[chave]);
            if (tempo) return tempo;
        }

        return numeroPositivo(tempos.padrao) || tempoGlobal;
    }

    function iniciar() {
        ajustarTela();
        window.addEventListener("resize", ajustarTela);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }

    window.PAINEL_BASE = {
        ajustarTela,
        esperar,
        definirCabecalho,
        obterTempoTela
    };

})();
