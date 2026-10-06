/* ================================================================
   CAL-TV — Calibração tipográfica para TV
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

    const tamanhos = [14, 16, 18, 20];
    const ctx = canvas.getContext("2d");
    const gradiente = ctx.createLinearGradient(0, 0, 0, 300);
    gradiente.addColorStop(0, "#1959b5");
    gradiente.addColorStop(1, "#3f8fe7");

    graficoTipografia = new window.Chart(canvas, {
        type: "bar",
        data: {
            labels: tamanhos.map(tamanho => `${tamanho} px`),
            datasets: [
                {
                    label: "Rótulo financeiro",
                    data: [68, 76, 84, 92],
                    backgroundColor: gradiente,
                    borderRadius: 8,
                    borderSkipped: false,
                    barPercentage: 0.68,
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
                    color: "#ffffff",
                    formatter: () => "R$ 2,58 mi",
                    font(context) {
                        return {
                            family: '"Segoe UI", Arial, Helvetica, sans-serif',
                            size: tamanhos[context.dataIndex],
                            weight: "800"
                        };
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
                            size: 16,
                            weight: "700"
                        },
                        padding: 8
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
        subtitulo: "Teste de legibilidade e tipografia",
        contexto: "CAL-TV"
    });

    const contador = document.getElementById("contador");
    const barra = document.getElementById("barraTempo");

    if (contador) contador.textContent = "MODO DE CALIBRAÇÃO";
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
