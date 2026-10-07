/* ================================================================
   CAL-TV — Referência tipográfica calibrada para TV
   Visão técnica estática, acessada com ?cal=1.
   ================================================================ */

let graficoTipografia = null;
let resolverEncerramento = null;

function registrarDatalabels() {
    if (!window.Chart || !window.ChartDataLabels) return;

    try {
        window.Chart.register(window.ChartDataLabels);
    } catch (erro) {
        console.warn("CAL-TV: não foi possível registrar ChartDataLabels.", erro);
    }
}

function criarGraficoTipografia() {
    const canvas = document.getElementById("calGraficoTipografia");
    if (!canvas || !window.Chart) return;

    registrarDatalabels();

    const coresBarras = ["#1959b5", "#88bdf3", "#9db4c9", "#f1b24b"];
    const coresRotulos = ["#ffffff", "#27333d", "#27333d", "#27333d"];

    graficoTipografia = new window.Chart(canvas, {
        type: "bar",
        data: {
            labels: ["Azul escuro", "Azul claro", "Cinza claro", "Amarelo"],
            datasets: [
                {
                    label: "Rótulo financeiro",
                    data: [82, 76, 70, 64],
                    backgroundColor: coresBarras,
                    borderRadius: 8,
                    borderSkipped: false,
                    barPercentage: 0.66,
                    categoryPercentage: 0.78
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            events: [],
            layout: {
                padding: {
                    top: 8,
                    right: 8,
                    bottom: 0,
                    left: 8
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
                    display: true,
                    anchor: "center",
                    align: "center",
                    color(context) {
                        return coresRotulos[context.dataIndex] || "#27333d";
                    },
                    formatter: () => "R$ 2,58 mi",
                    font: {
                        family: '"Segoe UI", Arial, Helvetica, sans-serif',
                        size: 22,
                        weight: "700"
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    border: {
                        display: false
                    },
                    ticks: {
                        color: "#4c5b67",
                        font: {
                            family: '"Segoe UI", Arial, Helvetica, sans-serif',
                            size: 22,
                            weight: "700"
                        },
                        padding: 8,
                        maxRotation: 0,
                        minRotation: 0
                    }
                },
                y: {
                    display: false,
                    beginAtZero: true,
                    suggestedMax: 100
                }
            }
        }
    });
}

function prepararCabecalho() {
    window.PAINEL_BASE?.definirCabecalho({
        titulo: "Calibração TV",
        subtitulo: "Referência tipográfica calibrada",
        contexto: "CAL-TV"
    });

    const contador = document.getElementById("contador");
    const barra = document.getElementById("barraTempo");

    if (contador) contador.textContent = "PADRÃO CALIBRADO";
    if (barra) barra.style.width = "100%";
}

export async function iniciar() {
    prepararCabecalho();
    criarGraficoTipografia();

    // A visão técnica permanece aberta até a página ser encerrada ou
    // recarregada. O player ignora o timeout quando ?cal=1 está ativo.
    return new Promise(resolve => {
        resolverEncerramento = resolve;
    });
}

export function destruir() {
    if (graficoTipografia) {
        graficoTipografia.destroy();
        graficoTipografia = null;
    }

    if (resolverEncerramento) {
        const resolver = resolverEncerramento;
        resolverEncerramento = null;
        resolver();
    }
}
