/* ================================================================
   PAINEL DE ACOMPANHAMENTO — PG-V2
   Configurações globais compartilhadas
   ================================================================ */

window.PAINEL_CONFIG = {

    padrao: {
        versao: "PG-V2"
    },

    tela: {
        largura: 1920,
        altura: 1080
    },

    atualizacao: {
        intervaloPadraoMs: 60000
    },

    transicoes: {
        conteudoMs: 230,
        visaoMs: 420
    },

    player: {
        recarregarAoFimDoCiclo: true,
        timeoutSegurancaMs: 300000
    },

    visoes: [
        {
            id: "DC-V1",
            ativo: false,
            nome: "Dia C",
            titulo: "Dia C",
            subtitulo: "Acompanhamento de mobilização e execução",
            fragmento: "./visoes/dia-c.html",
            css: "./css/dia-c.css",
            modulo: "./js/dia-c.js"
        },
        {
            id: "ME_EXEC-V1",
            ativo: true,
            nome: "Metas da Executiva",
            titulo: "Metas da Executiva",
            subtitulo: "Acompanhamento das notas por Categoria",
            fragmento: "./visoes/metas-executiva.html",
            css: "./css/metas-executiva.css",
            modulo: "./js/metas-executiva.js"
        },
        {
            id: "ME_GER-V1",
            ativo: true,
            nome: "Metas da Gerência",
            titulo: "Metas da Gerência",
            subtitulo: "Acompanhamento das notas por Categoria",
            fragmento: "./visoes/metas-gerencia.html",
            css: "./css/metas-gerencia.css",
            modulo: "./js/metas-gerencia.js"
        },
        {
            id: "COM-V1",
            ativo: true,
            nome: "Comissionamento de Obras",
            titulo: "Obras Comissionadas",
            subtitulo: "Volume financeiro por status de análise",
            fragmento: "./visoes/comissionamento.html",
            css: "./css/comissionamento.css",
            modulo: "./js/comissionamento.js"
        }
    ]

};
