/* ============================================================
   RULES/REGRASTRABALHISTAS.JS
   Único arquivo que concentra: tipos de desligamento, parâmetros
   configuráveis, a matriz de elegibilidade de verbas por tipo de
   rescisão e a lista de pontos de atenção/pendências jurídicas.

   Este módulo existe para que QUALQUER alteração de regra de
   negócio (um percentual, um prazo, uma elegibilidade) seja feita
   em um único lugar, sem tocar nos módulos de cálculo.
   ============================================================ */

/* ---------- Identificadores internos dos tipos de desligamento ---------- */
export const TIPOS_DESLIGAMENTO = Object.freeze({
    SEM_JUSTA_CAUSA: 'SEM_JUSTA_CAUSA',
    PEDIDO_DEMISSAO: 'PEDIDO_DEMISSAO',
    JUSTA_CAUSA: 'JUSTA_CAUSA',
    ACORDO: 'ACORDO',
    TERMINO_CONTRATO: 'TERMINO_CONTRATO'
});

/* ---------- Parâmetros configuráveis (documentação, seção 25) ---------- */
export const CONFIG_REGRAS = Object.freeze({
    diasBaseMes: 30, // base de dias usada no aviso-prévio (Salário ÷ 30)
    percentualTercoFerias: 1 / 3, // 1/3 constitucional
    diasAvisoMinimo: 30,
    diasAvisoPorAnoCompleto: 3,
    diasAvisoMaximo: 90,
    diasParaGanharAvo: 15, // regra genérica do avo (seção 7/8 da documentação)
    percentualAvisoAcordo: 0.5, // 50% do aviso indenizado no Acordo (fórmula 3.3)
    percentualMultaFgtsSemJustaCausa: 0.40,
    percentualMultaFgtsAcordo: 0.20,
    percentualFgtsSobreAviso: 0.08, // depósito informativo (fórmula seção 7 da documentação)
    mesesPadraoMediaHorasExtras: 12
});

/* ============================================================
   MATRIZ DE ELEGIBILIDADE POR TIPO DE DESLIGAMENTO
   ------------------------------------------------------------
   ATENÇÃO — REGRA ISOLADA E ASSUMIDA (não veio da documentação):
   o documento-base fornece as FÓRMULAS de cada verba, mas não uma
   tabela dizendo explicitamente quais verbas cabem em cada um dos
   5 tipos de desligamento. A matriz abaixo segue o entendimento
   geral e consolidado da CLT (ex.: justa causa não gera 13º/férias
   proporcionais, aviso-prévio indenizado ou multa de FGTS).
   Ela foi deixada isolada exatamente aqui, em formato de tabela,
   para que a Casa Contábil possa revisar/corrigir com um advogado
   trabalhista sem precisar mexer em nenhum módulo de cálculo.
   ============================================================ */
export const MATRIZ_ELEGIBILIDADE = Object.freeze({
    [TIPOS_DESLIGAMENTO.SEM_JUSTA_CAUSA]: {
        saldoSalario: true,
        feriasVencidas: true,
        feriasProporcionais: true,
        decimoTerceiro: true,
        avisoPrevio: 'INDENIZADO_100',
        multaFgts: 'QUARENTA',
        descontoAvisoNaoCumprido: false
    },
    [TIPOS_DESLIGAMENTO.PEDIDO_DEMISSAO]: {
        saldoSalario: true,
        feriasVencidas: true,
        feriasProporcionais: true,
        decimoTerceiro: true,
        avisoPrevio: 'NENHUM',
        multaFgts: 'NENHUMA',
        descontoAvisoNaoCumprido: true
    },
    [TIPOS_DESLIGAMENTO.JUSTA_CAUSA]: {
        // Regra geral CLT: perde 13º proporcional, férias proporcionais, aviso e multa FGTS.
        saldoSalario: true,
        feriasVencidas: true,
        feriasProporcionais: false,
        decimoTerceiro: false,
        avisoPrevio: 'NENHUM',
        multaFgts: 'NENHUMA',
        descontoAvisoNaoCumprido: false
    },
    [TIPOS_DESLIGAMENTO.ACORDO]: {
        saldoSalario: true,
        feriasVencidas: true,
        feriasProporcionais: true,
        decimoTerceiro: true,
        avisoPrevio: 'INDENIZADO_50',
        multaFgts: 'VINTE',
        descontoAvisoNaoCumprido: false
    },
    [TIPOS_DESLIGAMENTO.TERMINO_CONTRATO]: {
        // NÃO COBERTO PELA DOCUMENTAÇÃO — ver PENDENCIAS. Tratado de forma conservadora
        // (sem aviso-prévio e sem multa de FGTS, que dependem de regras não fornecidas).
        saldoSalario: true,
        feriasVencidas: true,
        feriasProporcionais: true,
        decimoTerceiro: true,
        avisoPrevio: 'NENHUM',
        multaFgts: 'NENHUMA',
        descontoAvisoNaoCumprido: false
    }
});

/* ============================================================
   PONTOS DE ATENÇÃO / PENDÊNCIAS JURÍDICAS
   ------------------------------------------------------------
   Exibidos diretamente na tela de resultado (ver ui/results.js),
   conforme instrução explícita do solicitante: "não esconder a
   situação" quando uma regra for ambígua, incompleta ou dependente
   de interpretação jurídica.
   ============================================================ */
export const PENDENCIAS_GERAIS = Object.freeze([{
        id: 'irrf',
        titulo: 'IRRF não calculado',
        descricao: 'A documentação-base solicitou o cálculo do IRRF, mas não forneceu a tabela de alíquotas/faixas vigente. O valor líquido exibido NÃO desconta o IRRF.'
    },
    {
        id: 'inss',
        titulo: 'INSS não calculado',
        descricao: 'Alíquotas e faixas do INSS não foram fornecidas na documentação-base. O valor líquido exibido NÃO desconta o INSS.'
    },
    {
        id: 'adicional-noturno',
        titulo: 'Adicional noturno não implementado',
        descricao: 'A documentação cita a necessidade, mas não traz a regra de cálculo. Não incluído nesta simulação.'
    },
    {
        id: 'periodo-avos',
        titulo: 'Período de contagem dos avos (13º e férias)',
        descricao: 'A documentação define apenas a regra genérica do avo (≥15 dias trabalhados no mês ⇒ +1/12). Os limites de cada período (ano civil para o 13º; período aquisitivo da admissão para as férias) seguem a prática padrão da CLT, não uma definição explícita do documento-base.'
    },
    {
        id: 'aviso-acordo-inconsistencia',
        titulo: 'Inconsistência no texto sobre o aviso-prévio no Acordo',
        descricao: 'A documentação afirma que os "dias de aviso" se aplicam apenas à rescisão sem justa causa, mas a própria fórmula do Acordo reutiliza esse mesmo valor multiplicado por 50%. Mantivemos o reaproveitamento (é a única forma de a fórmula do Acordo funcionar), mas o ponto está sinalizado para revisão.'
    },
    {
        id: 'termino-contrato',
        titulo: 'Término de contrato por prazo determinado não coberto',
        descricao: 'A documentação-base não traz fórmulas específicas para essa modalidade (ex.: indenização dos 50% dos dias restantes). Nesta simulação, calculamos apenas saldo de salário, férias e 13º proporcionais, sem aviso-prévio ou multa de FGTS.'
    },
    {
        id: 'ferias-dobradas',
        titulo: 'Férias vencidas em dobro não cobertas',
        descricao: 'A fórmula fornecida cobre apenas um período de férias vencidas simples. Casos de férias vencidas há mais de 12 meses sem gozo (pagamento em dobro) não foram implementados.'
    },
    {
        id: 'matriz-elegibilidade',
        titulo: 'Matriz de elegibilidade por tipo de rescisão é uma inferência',
        descricao: 'O documento-base fornece fórmulas, mas não uma tabela explícita dizendo quais verbas cabem em cada tipo de desligamento. A matriz usada segue o entendimento geral da CLT e está isolada em rules/regrasTrabalhistas.js para fácil revisão.'
    }
]);

/**
 * obterElegibilidade
 * Função de acesso único à matriz — nenhum módulo de cálculo deve
 * ler MATRIZ_ELEGIBILIDADE diretamente, para manter um ponto único
 * de alteração caso a estrutura da matriz mude no futuro.
 */
export function obterElegibilidade(tipoDesligamento) {
    return MATRIZ_ELEGIBILIDADE[tipoDesligamento] || null;
}