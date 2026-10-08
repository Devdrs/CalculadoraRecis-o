/* ============================================================
   APP.JS — CALCULADORA TRABALHISTA
   Casa Contábil

   Responsabilidades:
   - Inicialização da calculadora
   - Navegação entre etapas
   - Coleta e validação dos dados
   - Cálculo das verbas conforme documentação
   - Renderização do resultado
   - Memória de cálculo
   - Pendências
   - WhatsApp
   - Nova simulação
   - Persistência básica em localStorage

   IMPORTANTE:
   As fórmulas utilizadas aqui seguem a documentação fornecida
   para a Calculadora Trabalhista da Casa Contábil.

   INSS e IRRF permanecem pendentes enquanto suas tabelas não
   estiverem configuradas.
   ============================================================ */


/* ============================================================
   IMPORTS
   ============================================================ */

import {
    TIPOS_DESLIGAMENTO,
    CONFIG_REGRAS,
    obterElegibilidade,
    PENDENCIAS_GERAIS
} from './regrasTrabalhistas.js';


/* ============================================================
   CONFIGURAÇÕES
   ============================================================ */

const NUMERO_WHATSAPP_CASA_CONTABIL = '5569993842735';

const STORAGE_KEY = 'casaContabilCalculadoraTrabalhista';


/* ============================================================
   REFERÊNCIAS DOM
   ============================================================ */

const $ = (id) => document.getElementById(id);


/* ============================================================
   MOEDA
   ============================================================ */

/**
 * Converte qualquer valor recebido para número.
 */
const numeroSeguro = (valor) => {
    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        return 0;
    }

    return numero;
};


/**
 * Impede valores negativos.
 */
const naoNegativo = (valor) => {
    return Math.max(0, numeroSeguro(valor));
};


/**
 * Arredonda valores monetários para 2 casas.
 */
const arredondarMoeda = (valor) => {
    const numero = numeroSeguro(valor);

    return Math.round((numero + Number.EPSILON) * 100) / 100;
};


/**
 * Formata valores em reais.
 */
const formatarMoeda = (valor) => {
    return arredondarMoeda(valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
};


/* ============================================================
   CONVERSÃO DE CAMPOS
   ============================================================ */

/**
 * Converte:
 *
 * 3.000,50 -> 3000.50
 * 1000 -> 1000
 * 500,75 -> 500.75
 */
const moedaParaNumero = (valor) => {

    if (
        valor === null ||
        valor === undefined ||
        valor === ''
    ) {
        return 0;
    }

    if (typeof valor === 'number') {
        return Number.isFinite(valor) ? valor : 0;
    }

    const texto = String(valor)
        .trim()
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.');

    const numero = parseFloat(texto);

    return Number.isFinite(numero) ? numero : 0;
};


/**
 * Converte número simples.
 */
const numeroSimples = (valor) => {

    if (
        valor === null ||
        valor === undefined ||
        valor === ''
    ) {
        return 0;
    }

    const numero = parseFloat(
        String(valor).replace(',', '.')
    );

    return Number.isFinite(numero) ? numero : 0;
};


/* ============================================================
   DATAS
   ============================================================ */

/**
 * Cria uma data local sem os problemas comuns do:
 *
 * new Date('2026-10-08')
 *
 * que pode sofrer deslocamento de fuso.
 */
const criarDataLocal = (valor) => {

    if (!valor) {
        return null;
    }

    const partes = String(valor).split('-');

    if (partes.length !== 3) {
        return null;
    }

    const ano = Number(partes[0]);
    const mes = Number(partes[1]);
    const dia = Number(partes[2]);

    if (!Number.isInteger(ano) ||
        !Number.isInteger(mes) ||
        !Number.isInteger(dia)
    ) {
        return null;
    }

    const data = new Date(
        ano,
        mes - 1,
        dia
    );

    if (
        data.getFullYear() !== ano ||
        data.getMonth() !== mes - 1 ||
        data.getDate() !== dia
    ) {
        return null;
    }

    return data;
};


/**
 * Diferença entre duas datas em dias.
 */
const diferencaDias = (inicio, fim) => {

    if (!inicio || !fim) {
        return 0;
    }

    const MS_DIA = 24 * 60 * 60 * 1000;

    return Math.max(
        0,
        Math.floor(
            (fim.getTime() - inicio.getTime()) / MS_DIA
        )
    );
};


/**
 * Formata YYYY-MM-DD para DD/MM/YYYY.
 */
const formatarDataBR = (valor) => {

    const data = criarDataLocal(valor);

    if (!data) {
        return '-';
    }

    return data.toLocaleDateString('pt-BR');
};


/**
 * Retorna quantidade de dias do mês.
 */
const diasDoMes = (data) => {

    if (!data) {
        return 0;
    }

    return new Date(
        data.getFullYear(),
        data.getMonth() + 1,
        0
    ).getDate();
};


/**
 * Calcula dias trabalhados no mês da rescisão.
 *
 * Aqui é considerado o dia do desligamento como dia trabalhado.
 */
const calcularDiasTrabalhadosMes = (dataDesligamento) => {

    if (!dataDesligamento) {
        return 0;
    }

    return dataDesligamento.getDate();
};


/* ============================================================
   AVOS
   ============================================================ */

/**
 * Calcula os avos do 13º proporcional.
 *
 * Regra da documentação:
 * pelo menos 15 dias no mês = 1 avo.
 *
 * O 13º considera o ano da rescisão.
 */
const calcularAvosDecimoTerceiro = (
    dataAdmissao,
    dataDesligamento
) => {

    if (!dataAdmissao || !dataDesligamento) {
        return 0;
    }

    const ano = dataDesligamento.getFullYear();

    const inicioAno = new Date(
        ano,
        0,
        1
    );

    const inicio = dataAdmissao > inicioAno ?
        dataAdmissao :
        inicioAno;

    const mesInicial = inicio.getMonth();

    const mesFinal = dataDesligamento.getMonth();

    let avos = 0;

    for (
        let mes = mesInicial; mes <= mesFinal; mes++
    ) {

        const primeiroDia = new Date(
            ano,
            mes,
            1
        );

        const ultimoDia = new Date(
            ano,
            mes + 1,
            0
        );

        const inicioPeriodo =
            primeiroDia < inicio ?
            inicio :
            primeiroDia;

        const fimPeriodo =
            ultimoDia > dataDesligamento ?
            dataDesligamento :
            ultimoDia;

        const dias = diferencaDias(
            inicioPeriodo,
            fimPeriodo
        ) + 1;

        if (
            dias >=
            CONFIG_REGRAS.diasParaGanharAvo
        ) {
            avos++;
        }
    }

    return Math.min(12, Math.max(0, avos));
};


/**
 * Calcula os avos de férias proporcionais.
 *
 * Considera o período aquisitivo a partir da admissão.
 */
const calcularAvosFerias = (
    dataAdmissao,
    dataDesligamento
) => {

    if (!dataAdmissao || !dataDesligamento) {
        return 0;
    }

    if (dataDesligamento < dataAdmissao) {
        return 0;
    }

    const aniversario = new Date(
        dataDesligamento.getFullYear(),
        dataAdmissao.getMonth(),
        dataAdmissao.getDate()
    );

    let inicioPeriodo;

    if (aniversario > dataDesligamento) {

        inicioPeriodo = new Date(
            dataDesligamento.getFullYear() - 1,
            dataAdmissao.getMonth(),
            dataAdmissao.getDate()
        );

    } else {

        inicioPeriodo = aniversario;
    }

    let avos = 0;

    let ano = inicioPeriodo.getFullYear();
    let mes = inicioPeriodo.getMonth();

    while (avos < 12) {

        const inicioMes = new Date(
            ano,
            mes,
            inicioPeriodo.getDate()
        );

        const proximoMes = new Date(
            ano,
            mes + 1,
            inicioPeriodo.getDate()
        );

        if (inicioMes > dataDesligamento) {
            break;
        }

        const fimMes = new Date(
            proximoMes.getTime() - 1
        );

        const fimConsiderado =
            fimMes > dataDesligamento ?
            dataDesligamento :
            fimMes;

        const dias = diferencaDias(
            inicioMes,
            fimConsiderado
        ) + 1;

        if (
            dias >=
            CONFIG_REGRAS.diasParaGanharAvo
        ) {
            avos++;
        }

        mes++;

        if (mes > 11) {
            mes = 0;
            ano++;
        }
    }

    return Math.min(12, Math.max(0, avos));
};


/* ============================================================
   AVISO PRÉVIO
   ============================================================ */

/**
 * Calcula anos completos de serviço.
 *
 * Fórmula da documentação:
 *
 * floor(Tempo de Serviço em Dias / 365)
 */
const calcularAnosCompletos = (
    dataAdmissao,
    dataDesligamento
) => {

    const dias = diferencaDias(
        dataAdmissao,
        dataDesligamento
    );

    return Math.floor(
        dias / 365
    );
};


/**
 * Calcula dias de aviso.
 *
 * Fórmula definida na documentação:
 *
 * min(30 + anos_completos × 3, 90)
 */
const calcularDiasAviso = (
    anosCompletos
) => {

    return Math.min(
        CONFIG_REGRAS.diasAvisoMinimo +
        (
            anosCompletos *
            CONFIG_REGRAS.diasAvisoPorAnoCompleto
        ),
        CONFIG_REGRAS.diasAvisoMaximo
    );
};


/* ============================================================
   CÁLCULO PRINCIPAL
   ============================================================ */

const calcularSimulacao = (dados) => {

    const salario = naoNegativo(
        dados.salario
    );

    const dataAdmissao =
        criarDataLocal(dados.dataAdmissao);

    const dataDesligamento =
        criarDataLocal(dados.dataDesligamento);

    const tipo =
        dados.tipoDesligamento;

    const elegibilidade =
        obterElegibilidade(tipo);

    if (!elegibilidade) {
        throw new Error(
            'Tipo de desligamento inválido.'
        );
    }


    /* --------------------------------------------------------
       TEMPO DE SERVIÇO
       -------------------------------------------------------- */

    const tempoServicoDias =
        diferencaDias(
            dataAdmissao,
            dataDesligamento
        );

    const anosCompletos =
        Math.floor(
            tempoServicoDias / 365
        );

    const diasAviso =
        calcularDiasAviso(
            anosCompletos
        );


    /* --------------------------------------------------------
       SALDO DE SALÁRIO
       -------------------------------------------------------- */

    let saldoSalario = 0;

    if (elegibilidade.saldoSalario) {

        const totalDiasMes =
            diasDoMes(
                dataDesligamento
            );

        const diasTrabalhados =
            calcularDiasTrabalhadosMes(
                dataDesligamento
            );

        saldoSalario =
            (
                salario /
                totalDiasMes
            ) *
            diasTrabalhados;
    }


    saldoSalario =
        arredondarMoeda(
            saldoSalario
        );


    /* --------------------------------------------------------
       AVISO PRÉVIO
       -------------------------------------------------------- */

    let avisoPrevio = 0;

    if (
        elegibilidade.avisoPrevio ===
        'INDENIZADO_100'
    ) {

        avisoPrevio =
            (
                salario /
                CONFIG_REGRAS.diasBaseMes
            ) *
            diasAviso;

    } else if (
        elegibilidade.avisoPrevio ===
        'INDENIZADO_50'
    ) {

        avisoPrevio =
            (
                (
                    salario /
                    CONFIG_REGRAS.diasBaseMes
                ) *
                diasAviso
            ) *
            CONFIG_REGRAS.percentualAvisoAcordo;
    }


    avisoPrevio =
        arredondarMoeda(
            avisoPrevio
        );


    /* --------------------------------------------------------
       DESCONTO DE AVISO
       -------------------------------------------------------- */

    let descontoAvisoNaoCumprido = 0;

    if (
        elegibilidade.descontoAvisoNaoCumprido &&
        dados.avisoCumprido === 'nao'
    ) {

        descontoAvisoNaoCumprido =
            salario;
    }

    descontoAvisoNaoCumprido =
        arredondarMoeda(
            descontoAvisoNaoCumprido
        );


    /* --------------------------------------------------------
       13º PROPORCIONAL
       -------------------------------------------------------- */

    const avos13 =
        calcularAvosDecimoTerceiro(
            dataAdmissao,
            dataDesligamento
        );

    let decimoTerceiro = 0;

    if (elegibilidade.decimoTerceiro) {

        decimoTerceiro =
            (
                salario / 12
            ) *
            avos13;
    }

    decimoTerceiro =
        arredondarMoeda(
            decimoTerceiro
        );


    /* --------------------------------------------------------
       FÉRIAS
       -------------------------------------------------------- */

    let feriasVencidas = 0;

    if (
        elegibilidade.feriasVencidas &&
        dados.possuiFeriasVencidas
    ) {

        feriasVencidas =
            salario *
            (
                1 +
                CONFIG_REGRAS.percentualTercoFerias
            );
    }

    feriasVencidas =
        arredondarMoeda(
            feriasVencidas
        );


    const avosFerias =
        calcularAvosFerias(
            dataAdmissao,
            dataDesligamento
        );

    let feriasProporcionais = 0;

    if (
        elegibilidade.feriasProporcionais
    ) {

        feriasProporcionais =
            (
                (
                    salario / 12
                ) *
                avosFerias
            ) *
            (
                1 +
                CONFIG_REGRAS.percentualTercoFerias
            );
    }

    feriasProporcionais =
        arredondarMoeda(
            feriasProporcionais
        );


    /* --------------------------------------------------------
       HORAS EXTRAS
       -------------------------------------------------------- */

    let mediaHorasExtras = 0;
    let valorMediaHorasExtras = 0;
    let dsr = 0;

    if (dados.possuiVariaveis) {

        const mesesMedia =
            CONFIG_REGRAS
            .mesesPadraoMediaHorasExtras;

        mediaHorasExtras =
            numeroSimples(
                dados.somaHorasExtras12m
            ) /
            mesesMedia;

        valorMediaHorasExtras =
            mediaHorasExtras *
            moedaParaNumero(
                dados.valorHoraExtraAtual
            );


        /* ----------------------------------------------------
           DSR

           Fórmula da documentação:

           (Valor Total de Horas Extras no Mês
           ÷ Dias Úteis)
           × Domingos/Feriados
           ---------------------------------------------------- */

        const valorHorasExtrasMes =
            moedaParaNumero(
                dados.horasExtrasMesRescisao
            );

        const diasUteis =
            numeroSimples(
                dados.diasUteisMes
            );

        const domingosFeriados =
            numeroSimples(
                dados.domingosFeriadosMes
            );

        if (
            diasUteis > 0 &&
            domingosFeriados >= 0
        ) {

            dsr =
                (
                    valorHorasExtrasMes /
                    diasUteis
                ) *
                domingosFeriados;
        }
    }

    mediaHorasExtras =
        arredondarMoeda(
            mediaHorasExtras
        );

    valorMediaHorasExtras =
        arredondarMoeda(
            valorMediaHorasExtras
        );

    dsr =
        arredondarMoeda(
            dsr
        );


    /* --------------------------------------------------------
       FGTS
       -------------------------------------------------------- */

    let multaFgts = 0;

    const saldoFgts =
        naoNegativo(
            dados.saldoFgts
        );

    if (
        elegibilidade.multaFgts ===
        'QUARENTA'
    ) {

        multaFgts =
            saldoFgts *
            CONFIG_REGRAS
            .percentualMultaFgtsSemJustaCausa;

    } else if (
        elegibilidade.multaFgts ===
        'VINTE'
    ) {

        multaFgts =
            saldoFgts *
            CONFIG_REGRAS
            .percentualMultaFgtsAcordo;
    }

    multaFgts =
        arredondarMoeda(
            multaFgts
        );


    /* --------------------------------------------------------
       FGTS SOBRE AVISO
       -------------------------------------------------------- */

    let fgtsSobreAviso = 0;

    if (avisoPrevio > 0) {

        fgtsSobreAviso =
            avisoPrevio *
            CONFIG_REGRAS
            .percentualFgtsSobreAviso;
    }

    fgtsSobreAviso =
        arredondarMoeda(
            fgtsSobreAviso
        );


    /* --------------------------------------------------------
       DESCONTOS
       -------------------------------------------------------- */

    /*
     * INSS e IRRF permanecem 0 porque suas tabelas ainda
     * não foram configuradas.
     */

    const descontoINSS = 0;

    const descontoIRRF = 0;

    const adiantamentos =
        naoNegativo(
            dados.adiantamentos
        );


    const totalDescontos =
        arredondarMoeda(
            descontoINSS +
            descontoIRRF +
            descontoAvisoNaoCumprido +
            adiantamentos
        );


    /* --------------------------------------------------------
       TOTAL BRUTO
       -------------------------------------------------------- */

    const totalBruto =
        arredondarMoeda(
            saldoSalario +
            avisoPrevio +
            decimoTerceiro +
            feriasVencidas +
            feriasProporcionais +
            dsr +
            multaFgts
        );


    /* --------------------------------------------------------
       VALOR LÍQUIDO
       -------------------------------------------------------- */

    const valorLiquido =
        arredondarMoeda(
            totalBruto -
            totalDescontos
        );


    /* --------------------------------------------------------
       RESULTADO
       -------------------------------------------------------- */

    return {

        contrato: {
            dataAdmissao: dados.dataAdmissao,

            dataDesligamento: dados.dataDesligamento,

            salario,

            tipoDesligamento: tipo,

            avisoCumprido: dados.avisoCumprido
        },

        tempoServico: {
            dias: tempoServicoDias,

            anosCompletos
        },

        aviso: {
            dias: diasAviso,

            valor: avisoPrevio
        },

        saldoSalario,

        decimoTerceiro: {
            avos: avos13,

            valor: decimoTerceiro
        },

        ferias: {
            vencidas: feriasVencidas,

            avos: avosFerias,

            proporcionais: feriasProporcionais
        },

        horasExtras: {
            mediaHoras: mediaHorasExtras,

            valorMedia: valorMediaHorasExtras,

            dsr
        },

        fgts: {
            saldoInformado: saldoFgts,

            multa: multaFgts,

            fgtsSobreAviso
        },

        descontos: {
            inss: descontoINSS,

            irrf: descontoIRRF,

            avisoNaoCumprido: descontoAvisoNaoCumprido,

            adiantamentos
        },

        totalBruto,

        totalDescontos,

        valorLiquido,

        avisoPrevio,

        dsr,

        multaFgts
    };
};


/* ============================================================
   ERROS
   ============================================================ */

const mostrarErro = (
    id,
    mensagem
) => {

    const elemento = $(id);

    if (!elemento) {
        return;
    }

    elemento.textContent =
        mensagem || '';
};


const limparErros = () => {

    document
        .querySelectorAll('.tb-error')
        .forEach((elemento) => {
            elemento.textContent = '';
        });
};


/* ============================================================
   CAMPOS DINÂMICOS
   ============================================================ */

const atualizarCamposDinamicos = () => {
    const campoTipo = $('tipoDesligamento');
    const tipo = campoTipo ? .value || '';

    document
        .querySelectorAll('[data-visible-for]')
        .forEach((campo) => {
            const visiveis = (campo.dataset.visibleFor || '')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);

            campo.hidden = !visiveis.includes(tipo);
        });

    const grupoVariaveis = $('grupoVariaveis');
    if (grupoVariaveis) {
        const possuiVariaveis = $('possuiVariaveis') ? .checked === true;
        grupoVariaveis.hidden = !possuiVariaveis;
    }
};

/* ============================================================
   COLETA DOS DADOS
   ============================================================ */

const coletarDados = () => {
    return {
        dataAdmissao: $('dataAdmissao') ? .value || '',
        dataDesligamento: $('dataDesligamento') ? .value || '',
        salario: moedaParaNumero($('salario') ? .value),
        tipoDesligamento: $('tipoDesligamento') ? .value || '',
        avisoCumprido: $('avisoCumprido') ? .value || '',
        saldoFgts: moedaParaNumero($('saldoFgts') ? .value),
        possuiFeriasVencidas: $('possuiFeriasVencidas') ? .checked === true,
        possuiVariaveis: $('possuiVariaveis') ? .checked === true,
        somaHorasExtras12m: numeroSimples($('somaHorasExtras12m') ? .value),
        valorHoraExtraAtual: moedaParaNumero($('valorHoraExtraAtual') ? .value),
        horasExtrasMesRescisao: moedaParaNumero($('horasExtrasMesRescisao') ? .value),
        diasUteisMes: numeroSimples($('diasUteisMes') ? .value),
        domingosFeriadosMes: numeroSimples($('domingosFeriadosMes') ? .value),
        dependentes: numeroSimples($('dependentes') ? .value),
        adiantamentos: moedaParaNumero($('adiantamentos') ? .value),
        leadNome: $('leadNome') ? .value ? .trim() || '',
        leadTelefone: $('leadTelefone') ? .value ? .trim() || '',
        leadEmail: $('leadEmail') ? .value ? .trim() || ''
    };
};


/* ============================================================
   VALIDAÇÃO ETAPA 1
   ============================================================ */

const validoEtapa1 = () => {

    limparErros();

    const dados =
        coletarDados();

    let valido = true;


    if (!dados.dataAdmissao) {

        mostrarErro(
            'erro-dataAdmissao',
            'Informe a data de admissão.'
        );

        valido = false;
    }


    if (!dados.dataDesligamento) {

        mostrarErro(
            'erro-dataDesligamento',
            'Informe a data de desligamento.'
        );

        valido = false;
    }


    const admissao =
        criarDataLocal(
            dados.dataAdmissao
        );

    const desligamento =
        criarDataLocal(
            dados.dataDesligamento
        );


    if (
        admissao &&
        desligamento &&
        desligamento < admissao
    ) {

        mostrarErro(
            'erro-dataDesligamento',
            'A data de desligamento não pode ser anterior à data de admissão.'
        );

        valido = false;
    }


    if (!dados.salario ||
        dados.salario <= 0
    ) {

        mostrarErro(
            'erro-salario',
            'Informe um salário válido.'
        );

        valido = false;
    }


    if (!dados.tipoDesligamento) {

        mostrarErro(
            'erro-tipoDesligamento',
            'Selecione o tipo de desligamento.'
        );

        valido = false;
    }


    return valido;
};


/* ============================================================
   VALIDAÇÃO ETAPA 2
   ============================================================ */

const validarEtapa2 = (dados) => {

    let valido = true;

    const tipo =
        dados.tipoDesligamento;


    if (
        tipo ===
        TIPOS_DESLIGAMENTO.PEDIDO_DEMISSAO
    ) {

        if (!['sim', 'nao']
            .includes(
                dados.avisoCumprido
            )
        ) {

            mostrarErro(
                'erro-avisoCumprido',
                'Informe se o aviso-prévio foi cumprido.'
            );

            valido = false;
        }
    }


    if (
        [
            TIPOS_DESLIGAMENTO.SEM_JUSTA_CAUSA,
            TIPOS_DESLIGAMENTO.ACORDO
        ].includes(tipo)
    ) {

        if (dados.saldoFgts < 0) {

            mostrarErro(
                'erro-saldoFgts',
                'O saldo do FGTS não pode ser negativo.'
            );

            valido = false;
        }
    }


    if (dados.possuiVariaveis) {

        if (
            dados.somaHorasExtras12m < 0
        ) {
            valido = false;
        }

        if (
            dados.valorHoraExtraAtual < 0
        ) {
            valido = false;
        }

        if (
            dados.horasExtrasMesRescisao < 0
        ) {
            valido = false;
        }

        if (
            dados.diasUteisMes <= 0
        ) {

            mostrarErro(
                'erro-diasUteisMes',
                'Informe uma quantidade válida de dias úteis.'
            );

            valido = false;
        }

        if (
            dados.domingosFeriadosMes < 0
        ) {

            mostrarErro(
                'erro-domingosFeriadosMes',
                'Informe uma quantidade válida de domingos e feriados.'
            );

            valido = false;
        }
    }


    if (dados.adiantamentos < 0) {

        mostrarErro(
            'erro-adiantamentos',
            'O valor de adiantamentos não pode ser negativo.'
        );

        valido = false;
    }


    return valido;
};


/* ============================================================
   NAVEGAÇÃO
   ============================================================ */

const mostrarEtapa = (numero) => {

    document
        .querySelectorAll('.tb-step')
        .forEach((step) => {

            const ativa =
                Number(step.dataset.step) === numero;

            step.classList.toggle(
                'is-active',
                ativa
            );
        });


    document
        .querySelectorAll(
            '[data-step-indicator]'
        )
        .forEach((step) => {

            const etapaAtual =
                Number(
                    step.dataset.stepIndicator
                );

            step.classList.toggle(
                'is-active',
                etapaAtual === numero
            );

            step.classList.toggle(
                'is-done',
                etapaAtual < numero
            );
        });
};


/* ============================================================
   RESUMO
   ============================================================ */

const renderizarResumo = (
    resultado
) => {

    const grid =
        $('tbResumoGrid');

    if (!grid) {
        return;
    }


    const itens = [

        {
            label: 'Saldo de salário',
            valor: formatarMoeda(
                resultado.saldoSalario
            )
        },

        {
            label: 'Aviso-prévio',
            valor: formatarMoeda(
                resultado.avisoPrevio
            )
        },

        {
            label: '13º proporcional',
            valor: formatarMoeda(
                resultado.decimoTerceiro.valor
            )
        },

        {
            label: 'Férias vencidas',
            valor: formatarMoeda(
                resultado.ferias.vencidas
            )
        },

        {
            label: 'Férias proporcionais',
            valor: formatarMoeda(
                resultado.ferias.proporcionais
            )
        },

        {
            label: 'DSR',
            valor: formatarMoeda(
                resultado.dsr
            )
        },

        {
            label: 'Multa FGTS',
            valor: formatarMoeda(
                resultado.multaFgts
            )
        }
    ];


    grid.innerHTML =
        itens.map(
            (item) => `
                <div class="tb-resumo-item">
                    <span class="tb-resumo-label">
                        ${item.label}
                    </span>

                    <strong class="tb-resumo-valor">
                        ${item.valor}
                    </strong>
                </div>
            `
        ).join('');
};


/* ============================================================
   PENDÊNCIAS
   ============================================================ */

const renderizarPendencias = (
    resultado
) => {

    const lista =
        $('tbListaPendencias');

    const bloco =
        $('tbPendencias');

    if (!lista || !bloco) {
        return;
    }


    const pendencias = [
        ...PENDENCIAS_GERAIS
    ];


    if (
        resultado.fgts.saldoInformado === 0 && [
            TIPOS_DESLIGAMENTO.SEM_JUSTA_CAUSA,
            TIPOS_DESLIGAMENTO.ACORDO
        ].includes(
            resultado.contrato.tipoDesligamento
        )
    ) {

        pendencias.push({
            titulo: 'Saldo do FGTS não informado',
            descricao: 'A multa do FGTS foi calculada sobre R$ 0,00 porque nenhum saldo foi informado no extrato.'
        });
    }


    lista.innerHTML =
        pendencias.map(
            (item) => {

                const texto =
                    item.descricao ||
                    item.titulo ||
                    item;

                return `
                    <li>
                        ${texto}
                    </li>
                `;
            }
        ).join('');


    bloco.hidden = false;
};


/* ============================================================
   MEMÓRIA DE CÁLCULO
   ============================================================ */

const renderizarMemoria = (
    resultado
) => {

    const container =
        $('tbMemoriaConteudo');

    if (!container) {
        return;
    }


    container.innerHTML = `

        <div class="tb-memoria-verba">
            <h4>Saldo de salário</h4>

            <p>
                Dias trabalhados:
                ${resultado.contrato.dataDesligamento
                    ? criarDataLocal(resultado.contrato.dataDesligamento).getDate()
                    : 0}
            </p>

            <div class="tb-memoria-formula">
                (Salário ÷ dias do mês) × dias trabalhados
            </div>

            <p class="tb-memoria-resultado">
                ${formatarMoeda(resultado.saldoSalario)}
            </p>
        </div>


        <div class="tb-memoria-verba">
            <h4>Aviso-prévio</h4>

            <p>
                Dias calculados:
                ${resultado.aviso.dias}
            </p>

            <div class="tb-memoria-formula">
                (Salário ÷ 30) × dias de aviso
            </div>

            <p class="tb-memoria-resultado">
                ${formatarMoeda(resultado.aviso.valor)}
            </p>
        </div>


        <div class="tb-memoria-verba">
            <h4>13º proporcional</h4>

            <p>
                Avos:
                ${resultado.decimoTerceiro.avos}/12
            </p>

            <div class="tb-memoria-formula">
                (Salário ÷ 12) × avos
            </div>

            <p class="tb-memoria-resultado">
                ${formatarMoeda(
                    resultado.decimoTerceiro.valor
                )}
            </p>
        </div>


        <div class="tb-memoria-verba">
            <h4>Férias vencidas</h4>

            <div class="tb-memoria-formula">
                Salário × 1,3333
            </div>

            <p class="tb-memoria-resultado">
                ${formatarMoeda(
                    resultado.ferias.vencidas
                )}
            </p>
        </div>


        <div class="tb-memoria-verba">
            <h4>Férias proporcionais</h4>

            <p>
                Avos:
                ${resultado.ferias.avos}/12
            </p>

            <div class="tb-memoria-formula">
                (Salário ÷ 12 × avos) × 1,3333
            </div>

            <p class="tb-memoria-resultado">
                ${formatarMoeda(
                    resultado.ferias.proporcionais
                )}
            </p>
        </div>


        <div class="tb-memoria-verba">
            <h4>DSR</h4>

            <div class="tb-memoria-formula">
                (Horas extras do mês ÷ dias úteis)
                × domingos/feriados
            </div>

            <p class="tb-memoria-resultado">
                ${formatarMoeda(
                    resultado.dsr
                )}
            </p>
        </div>


        <div class="tb-memoria-verba">
            <h4>Multa do FGTS</h4>

            <p>
                Saldo informado:
                ${formatarMoeda(
                    resultado.fgts.saldoInformado
                )}
            </p>

            <div class="tb-memoria-formula">
                Saldo FGTS × percentual aplicável
            </div>

            <p class="tb-memoria-resultado">
                ${formatarMoeda(
                    resultado.fgts.multa
                )}
            </p>
        </div>


        <div class="tb-memoria-verba">
            <h4>FGTS sobre aviso-prévio</h4>

            <div class="tb-memoria-formula">
                Aviso-prévio × 0,08
            </div>

            <p class="tb-memoria-resultado">
                ${formatarMoeda(
                    resultado.fgts.fgtsSobreAviso
                )}
            </p>

            <p class="tb-memoria-naoaplicavel">
                Valor informativo. Não foi somado novamente ao total bruto.
            </p>
        </div>


        <div class="tb-memoria-verba">
            <h4>Descontos</h4>

            <p>
                INSS:
                ${formatarMoeda(
                    resultado.descontos.inss
                )}
            </p>

            <p>
                IRRF:
                ${formatarMoeda(
                    resultado.descontos.irrf
                )}
            </p>

            <p>
                Aviso não cumprido:
                ${formatarMoeda(
                    resultado.descontos.avisoNaoCumprido
                )}
            </p>

            <p>
                Adiantamentos:
                ${formatarMoeda(
                    resultado.descontos.adiantamentos
                )}
            </p>

            <p class="tb-memoria-resultado">
                Total:
                ${formatarMoeda(
                    resultado.totalDescontos
                )}
            </p>
        </div>

    `;
};


/* ============================================================
   LOCAL STORAGE
   ============================================================ */

const salvarSimulacao = (
    dados,
    resultado
) => {

    try {

        const armazenamento = {
            dados,
            resultado,
            atualizadoEm: new Date().toISOString()
        };

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(
                armazenamento
            )
        );

    } catch (erro) {

        console.warn(
            'Não foi possível salvar a simulação.',
            erro
        );
    }
};


/**
 * Remove dados armazenados.
 */
const limparSimulacao = () => {

    try {

        localStorage.removeItem(
            STORAGE_KEY
        );

    } catch (erro) {

        console.warn(
            'Não foi possível limpar a simulação.',
            erro
        );
    }
};


/* ============================================================
   WHATSAPP
   ============================================================ */

const gerarLinkWhatsApp = (
    dados,
    resultado
) => {

    const nomesTipo = {

        [TIPOS_DESLIGAMENTO.SEM_JUSTA_CAUSA]: 'Demissão sem justa causa',

        [TIPOS_DESLIGAMENTO.PEDIDO_DEMISSAO]: 'Pedido de demissão',

        [TIPOS_DESLIGAMENTO.JUSTA_CAUSA]: 'Justa causa',

        [TIPOS_DESLIGAMENTO.ACORDO]: 'Rescisão por acordo',

        [TIPOS_DESLIGAMENTO.TERMINO_CONTRATO]: 'Término de contrato por prazo determinado'
    };


    const linhas = [

        'Olá! Fiz uma simulação na Calculadora Trabalhista da Casa Contábil e gostaria de confirmar o resultado.',

        dados.leadNome ?
        `Nome: ${dados.leadNome}` :
        null,

        dados.leadTelefone ?
        `Telefone: ${dados.leadTelefone}` :
        null,

        dados.leadEmail ?
        `E-mail: ${dados.leadEmail}` :
        null,

        `Tipo de rescisão: ${
            nomesTipo[
                resultado.contrato.tipoDesligamento
            ] || '-'
        }`,

        `Salário: ${
            formatarMoeda(
                resultado.contrato.salario
            )
        }`,

        `Admissão: ${
            formatarDataBR(
                resultado.contrato.dataAdmissao
            )
        }`,

        `Desligamento: ${
            formatarDataBR(
                resultado.contrato.dataDesligamento
            )
        }`,

        `Total Bruto: ${
            formatarMoeda(
                resultado.totalBruto
            )
        }`,

        `Total de Descontos: ${
            formatarMoeda(
                resultado.totalDescontos
            )
        }`,

        `Valor Líquido estimado: ${
            formatarMoeda(
                resultado.valorLiquido
            )
        }`,

        '',
        'Observação: o valor é uma estimativa e atualmente não considera INSS e IRRF.'
    ].filter(Boolean);


    const texto =
        encodeURIComponent(
            linhas.join('\n')
        );


    return `https://wa.me/${NUMERO_WHATSAPP_CASA_CONTABIL}?text=${texto}`;
};


/* ============================================================
   ÚLTIMO RESULTADO
   ============================================================ */

let ultimoResultado = null;


/* ============================================================
   AVANÇAR
   ============================================================ */

const tratarAvancar = () => {

    if (!validoEtapa1()) {
        return;
    }

    mostrarEtapa(2);
};


/* ============================================================
   VOLTAR
   ============================================================ */

const tratarVoltar = () => {

    mostrarEtapa(1);

    atualizarCamposDinamicos();
};


/* ============================================================
   CALCULAR
   ============================================================ */

const tratarCalcular = () => {

    limparErros();

    const dados =
        coletarDados();


    if (!validarEtapa2(
            dados
        )) {

        return;
    }


    try {

        const resultado =
            calcularSimulacao(
                dados
            );


        ultimoResultado =
            resultado;


        const totalBruto =
            $('tbTotalBruto');

        const totalDescontos =
            $('tbTotalDescontos');

        const valorLiquido =
            $('tbValorLiquido');


        if (totalBruto) {

            totalBruto.textContent =
                formatarMoeda(
                    resultado.totalBruto
                );
        }


        if (totalDescontos) {

            totalDescontos.textContent =
                formatarMoeda(
                    resultado.totalDescontos
                );
        }


        if (valorLiquido) {

            valorLiquido.textContent =
                formatarMoeda(
                    resultado.valorLiquido
                );
        }


        renderizarResumo(
            resultado
        );


        renderizarPendencias(
            resultado
        );


        renderizarMemoria(
            resultado
        );


        salvarSimulacao(
            dados,
            resultado
        );


        const resultadoBox =
            $('tbResultado');


        if (resultadoBox) {

            resultadoBox.hidden = false;

            resultadoBox.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }


    } catch (erro) {

        console.error(
            'Erro ao calcular a simulação:',
            erro
        );


        alert(
            'Não foi possível calcular a simulação. Verifique os dados informados e tente novamente.'
        );
    }
};


/* ============================================================
   NOVO CÁLCULO
   ============================================================ */

const tratarNovoCalculo = () => {

    const formulario =
        $('tbForm');

    if (formulario) {
        formulario.reset();
    }


    limparSimulacao();

    ultimoResultado = null;


    const resultado =
        $('tbResultado');

    if (resultado) {
        resultado.hidden = true;
    }


    limparErros();

    mostrarEtapa(1);

    atualizarCamposDinamicos();

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
};


/* ============================================================
   WHATSAPP
   ============================================================ */

const tratarEnvioWhatsApp = (
    event
) => {

    if (!ultimoResultado) {

        event.preventDefault();

        alert(
            'Faça uma simulação antes de falar com o contador.'
        );

        return;
    }


    const dados =
        coletarDados();


    const link =
        gerarLinkWhatsApp(
            dados,
            ultimoResultado
        );


    event.currentTarget.href =
        link;
};


/* ============================================================
   EVENTOS
   ============================================================ */

const registrarEventos = () => {

    const tipoDesligamento =
        $('tipoDesligamento');

    if (tipoDesligamento) {

        tipoDesligamento.addEventListener(
            'change',
            atualizarCamposDinamicos
        );
    }


    const possuiVariaveis =
        $('possuiVariaveis');

    if (possuiVariaveis) {

        possuiVariaveis.addEventListener(
            'change',
            atualizarCamposDinamicos
        );
    }


    document.body.addEventListener(
        'click',
        (evento) => {

            const botao =
                evento.target.closest(
                    '[data-action]'
                );


            if (!botao) {
                return;
            }


            const acao =
                botao.dataset.action;


            if (acao === 'next') {

                evento.preventDefault();

                tratarAvancar();

            } else if (acao === 'prev') {

                evento.preventDefault();

                tratarVoltar();

            } else if (acao === 'calcular') {

                evento.preventDefault();

                tratarCalcular();
            }
        }
    );


    const btnNovoCalculo =
        $('btnNovoCalculo');

    if (btnNovoCalculo) {

        btnNovoCalculo.addEventListener(
            'click',
            tratarNovoCalculo
        );
    }


    const btnWhatsApp =
        $('btnFalarContadorResultado');

    if (btnWhatsApp) {

        btnWhatsApp.addEventListener(
            'click',
            tratarEnvioWhatsApp
        );
    }
};


/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

const inicializar = () => {

    mostrarEtapa(1);

    atualizarCamposDinamicos();

    registrarEventos();


    const ano =
        $('ano');

    if (ano) {

        ano.textContent =
            new Date().getFullYear();
    }
};


/* ============================================================
   DOM READY
   ============================================================ */

if (
    document.readyState ===
    'loading'
) {

    document.addEventListener(
        'DOMContentLoaded',
        inicializar
    );

} else {

    inicializar();
}