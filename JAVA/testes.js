/* ============================================================
   TESTS/TESTES.JS
   Suíte de testes automatizados, sem dependências externas.
   Roda com: node tests/testes.js
   Cobre os 10 cenários pedidos na documentação (seção 21) + casos
   extras de validação/robustez.
   ============================================================ */

import { calcularRescisao } from '../js/calculations/rescisao.js';
import { validarEtapa1, validarEtapa2 } from '../js/validators/validacoes.js';
import { arredondarMoeda, formatarMoeda } from '../js/utils/currency.js';

let total = 0,
    passou = 0;
const falhas = [];

function aproximadamenteIgual(a, b, tolerancia = 0.01) {
    return Math.abs(a - b) <= tolerancia;
}

function testar(descricao, fn) {
    total++;
    try {
        fn();
        passou++;
        console.log(`  ✅ ${descricao}`);
    } catch (e) {
        falhas.push({ descricao, erro: e.message });
        console.log(`  ❌ ${descricao} — ${e.message}`);
    }
}

function assert(condicao, mensagem) {
    if (!condicao) throw new Error(mensagem);
}

function assertValor(valorObtido, valorEsperado, contexto) {
    assert(
        aproximadamenteIgual(valorObtido, valorEsperado),
        `${contexto}: esperado ${formatarMoeda(valorEsperado)}, obtido ${formatarMoeda(valorObtido)}`
    );
}

const dadosBase = (overrides = {}) => ({
    dataAdmissao: '2022-03-10',
    dataDesligamento: '2026-01-15',
    salario: '3.000,00',
    tipoDesligamento: 'SEM_JUSTA_CAUSA',
    ...overrides
});

/* ============================================================
   CASO 1 — Empregado com poucos meses de contrato
   ============================================================ */
console.log('\n=== CASO 1: poucos meses de contrato ===');
testar('Saldo de salário calculado para contrato curto (sem justa causa)', () => {
    const r = calcularRescisao(dadosBase({
        dataAdmissao: '2025-11-01',
        dataDesligamento: '2026-01-15',
        salario: '2.000,00'
    }));
    // Janeiro/2026 tem 31 dias; desligamento dia 15 => 2000/31*15
    const esperado = arredondarMoeda((2000 / 31) * 15);
    assertValor(r.itens.find(i => i.id === 'saldoSalario').valor, esperado, 'Saldo de salário');
    assert(r.totalBruto > 0, 'Total bruto deve ser maior que zero');
});

/* ============================================================
   CASO 2 — 1 ano de contrato
   ============================================================ */
console.log('\n=== CASO 2: 1 ano de contrato ===');
testar('Dias de aviso com 1 ano completo = 30 (sem anos completos extras)', () => {
    // 2025-01-10 a 2026-01-10 = exatamente 365 dias = 1 ano completo
    const r = calcularRescisao(dadosBase({
        dataAdmissao: '2025-01-10',
        dataDesligamento: '2026-01-10',
        salario: '3.000,00'
    }));
    assert(r.variaveis.anosCompletos === 1, `anos_completos deveria ser 1, obtido ${r.variaveis.anosCompletos}`);
    assert(r.variaveis.diasAviso === 33, `dias_aviso deveria ser 33 (30+1×3), obtido ${r.variaveis.diasAviso}`);
});

/* ============================================================
   CASO 3 — Vários anos de contrato
   ============================================================ */
console.log('\n=== CASO 3: vários anos de contrato ===');
testar('Dias de aviso respeita o teto de 90 dias com muitos anos', () => {
    const r = calcularRescisao(dadosBase({
        dataAdmissao: '2005-01-10',
        dataDesligamento: '2026-01-15',
        salario: '5.000,00'
    }));
    assert(r.variaveis.diasAviso === 90, `dias_aviso deveria ser travado em 90, obtido ${r.variaveis.diasAviso}`);
    const esperadoAviso = arredondarMoeda((5000 / 30) * 90);
    assertValor(r.itens.find(i => i.id === 'avisoPrevio').valor, esperadoAviso, 'Aviso-prévio (teto)');
});

/* ============================================================
   CASO 4 — Pedido de demissão
   ============================================================ */
console.log('\n=== CASO 4: pedido de demissão ===');
testar('Pedido de demissão: sem aviso indenizado, sem multa FGTS', () => {
    const r = calcularRescisao(dadosBase({ tipoDesligamento: 'PEDIDO_DEMISSAO' }));
    assert(r.itens.find(i => i.id === 'avisoPrevio').aplicavel === false, 'Não deveria ter aviso-prévio indenizado');
    assert(r.itens.find(i => i.id === 'multaFgts').aplicavel === false, 'Não deveria ter multa de FGTS');
});
testar('Pedido de demissão sem cumprir aviso: desconta 1 salário', () => {
    const r = calcularRescisao(dadosBase({ tipoDesligamento: 'PEDIDO_DEMISSAO', avisoCumprido: 'nao', salario: '2.500,00' }));
    const desconto = r.itens.find(i => i.id === 'descontoAvisoNaoCumprido');
    assert(desconto.aplicavel === true, 'Deveria aplicar desconto de aviso não cumprido');
    assertValor(desconto.valor, 2500, 'Desconto de aviso não cumprido');
});

/* ============================================================
   CASO 5 — Demissão sem justa causa
   ============================================================ */
console.log('\n=== CASO 5: demissão sem justa causa ===');
testar('Sem justa causa: aviso 100%, multa FGTS 40%', () => {
    const r = calcularRescisao(dadosBase({ tipoDesligamento: 'SEM_JUSTA_CAUSA', saldoFgts: '8.000,00' }));
    assertValor(r.itens.find(i => i.id === 'multaFgts').valor, 8000 * 0.40, 'Multa FGTS 40%');
    assert(r.itens.find(i => i.id === 'avisoPrevio').aplicavel === true, 'Deveria ter aviso-prévio indenizado');
});

/* ============================================================
   CASO 6 — Justa causa
   ============================================================ */
console.log('\n=== CASO 6: justa causa ===');
testar('Justa causa: sem 13º, sem férias proporcionais, sem aviso, sem multa', () => {
    const r = calcularRescisao(dadosBase({ tipoDesligamento: 'JUSTA_CAUSA', saldoFgts: '5.000,00' }));
    assert(r.itens.find(i => i.id === 'decimoTerceiro').aplicavel === false, 'Não deveria ter 13º');
    assert(r.itens.find(i => i.id === 'feriasProporcionais').aplicavel === false, 'Não deveria ter férias proporcionais');
    assert(r.itens.find(i => i.id === 'avisoPrevio').aplicavel === false, 'Não deveria ter aviso-prévio');
    assert(r.itens.find(i => i.id === 'multaFgts').aplicavel === false, 'Não deveria ter multa de FGTS');
    assert(r.itens.find(i => i.id === 'saldoSalario').aplicavel === true, 'Saldo de salário sempre se aplica');
});

/* ============================================================
   CASO 7 — Acordo
   ============================================================ */
console.log('\n=== CASO 7: acordo ===');
testar('Acordo: aviso 50% e multa FGTS 20%', () => {
    const r = calcularRescisao(dadosBase({
        tipoDesligamento: 'ACORDO',
        dataAdmissao: '2020-01-10',
        dataDesligamento: '2026-01-15',
        saldoFgts: '10.000,00'
    }));
    const anosCompletos = r.variaveis.anosCompletos;
    const diasAviso = Math.min(30 + anosCompletos * 3, 90);
    const esperadoAviso = arredondarMoeda(((3000 / 30) * diasAviso) * 0.5);
    assertValor(r.itens.find(i => i.id === 'avisoPrevio').valor, esperadoAviso, 'Aviso-prévio no acordo (50%)');
    assertValor(r.itens.find(i => i.id === 'multaFgts').valor, 10000 * 0.20, 'Multa FGTS 20%');
});

/* ============================================================
   CASO 8 — Admissão e desligamento em anos diferentes
   ============================================================ */
console.log('\n=== CASO 8: admissão e desligamento em anos diferentes ===');
testar('Avos de 13º contam apenas o ano civil do desligamento', () => {
    // Admitido em 2023; desligado em março/2026 → avos_13 contam só jan-mar/2026
    const r = calcularRescisao(dadosBase({
        dataAdmissao: '2023-05-10',
        dataDesligamento: '2026-03-20',
        salario: '3.000,00'
    }));
    // jan (31 dias, >=15), fev (28, >=15), mar (1-20=20 dias, >=15) => 3 avos
    assert(r.variaveis.avos13 === 3, `avos_13 deveria ser 3, obtido ${r.variaveis.avos13}`);
});

/* ============================================================
   CASO 9 — Ano bissexto
   ============================================================ */
console.log('\n=== CASO 9: ano bissexto ===');
testar('Saldo de salário usa 29 dias em fevereiro de ano bissexto (2028)', () => {
    const r = calcularRescisao(dadosBase({
        dataAdmissao: '2026-01-01',
        dataDesligamento: '2028-02-20',
        salario: '2.900,00'
    }));
    const esperado = arredondarMoeda((2900 / 29) * 20);
    assertValor(r.itens.find(i => i.id === 'saldoSalario').valor, esperado, 'Saldo de salário (fevereiro bissexto)');
});
testar('Avo de fevereiro bissexto com 15 dias trabalhados conta +1/12', () => {
    // Período aquisitivo de férias começando em 01/01/2028 (bissexto),
    // desligamento em 15/02/2028 → janeiro completo (31>=15) + fevereiro (15>=15) = 2 avos
    const r = calcularRescisao(dadosBase({
        dataAdmissao: '2026-01-01',
        dataDesligamento: '2028-02-15',
        salario: '2.000,00'
    }));
    assert(r.variaveis.avosFerias === 2, `avosFerias deveria ser 2, obtido ${r.variaveis.avosFerias}`);
});

/* ============================================================
   CASO 10 — Salário com centavos
   ============================================================ */
console.log('\n=== CASO 10: salário com centavos ===');
testar('Salário com centavos (R$ 1.637,50) não gera erro de arredondamento', () => {
    const r = calcularRescisao(dadosBase({ salario: '1.637,50', dataDesligamento: '2026-01-10' }));
    const diasTotaisMes = 31;
    const esperado = arredondarMoeda((1637.50 / diasTotaisMes) * 10);
    assertValor(r.itens.find(i => i.id === 'saldoSalario').valor, esperado, 'Saldo de salário com centavos');
    assert(Number.isFinite(r.totalBruto), 'Total bruto deve ser um número finito');
});

/* ============================================================
   TESTES EXTRAS — validações e robustez (NaN/Infinity/campos vazios)
   ============================================================ */
console.log('\n=== EXTRA: validações ===');
testar('Rejeita desligamento anterior à admissão', () => {
    const { valido, erros } = validarEtapa1(dadosBase({ dataAdmissao: '2026-05-01', dataDesligamento: '2026-01-01' }));
    assert(valido === false, 'Deveria ser inválido');
    assert(Boolean(erros.dataDesligamento), 'Deveria ter mensagem de erro em dataDesligamento');
});
testar('Rejeita salário zero ou vazio', () => {
    const { valido } = validarEtapa1(dadosBase({ salario: '' }));
    assert(valido === false, 'Deveria ser inválido com salário vazio');
});
testar('Rejeita FGTS negativo', () => {
    const { valido, erros } = validarEtapa2({ saldoFgts: '-500,00' });
    assert(valido === false, 'Deveria ser inválido com FGTS negativo');
    assert(Boolean(erros.saldoFgts), 'Deveria sinalizar erro em saldoFgts');
});
testar('Rejeita dias úteis fora do intervalo plausível', () => {
    const { valido, erros } = validarEtapa2({ possuiVariaveis: true, diasUteisMes: '40', somaHorasExtras12m: '10', valorHoraExtraAtual: '20,00', horasExtrasMesRescisao: '50,00', domingosFeriadosMes: '4' });
    assert(valido === false, 'Deveria ser inválido com 40 dias úteis');
    assert(Boolean(erros.diasUteisMes), 'Deveria sinalizar erro em diasUteisMes');
});
testar('Nenhum resultado numérico é NaN ou Infinity mesmo com campos opcionais vazios', () => {
    const r = calcularRescisao(dadosBase({ saldoFgts: '', adiantamentos: '', dependentes: '' }));
    r.itens.forEach(item => {
        assert(Number.isFinite(item.valor), `Item ${item.id} retornou valor não finito: ${item.valor}`);
    });
    assert(Number.isFinite(r.totalBruto), 'totalBruto não finito');
    assert(Number.isFinite(r.totalDescontos), 'totalDescontos não finito');
    assert(Number.isFinite(r.valorLiquido), 'valorLiquido não finito');
});
testar('INSS e IRRF ficam explicitamente pendentes (nunca inventam valor)', () => {
    const r = calcularRescisao(dadosBase());
    const inss = r.itens.find(i => i.id === 'inss');
    const irrf = r.itens.find(i => i.id === 'irrf');
    assert(inss.pendente === true && inss.valor === 0, 'INSS deveria estar pendente e com valor 0');
    assert(irrf.pendente === true && irrf.valor === 0, 'IRRF deveria estar pendente e com valor 0');
});
testar('Total Bruto bate com a soma manual das 7 verbas da fórmula 8.1', () => {
    const r = calcularRescisao(dadosBase({ tipoDesligamento: 'SEM_JUSTA_CAUSA', saldoFgts: '4.000,00' }));
    const porId = Object.fromEntries(r.itens.map(i => [i.id, i]));
    const somaManual = arredondarMoeda(
        porId.saldoSalario.valor + porId.avisoPrevio.valor + porId.decimoTerceiro.valor +
        porId.feriasVencidas.valor + porId.feriasProporcionais.valor + porId.dsr.valor + porId.multaFgts.valor
    );
    assertValor(r.totalBruto, somaManual, 'Total Bruto (soma manual)');
});
testar('Valor Líquido = Total Bruto − Total Descontos', () => {
    const r = calcularRescisao(dadosBase({ adiantamentos: '200,00' }));
    assertValor(r.valorLiquido, arredondarMoeda(r.totalBruto - r.totalDescontos), 'Valor Líquido');
});

/* ============================================================
   RESUMO FINAL
   ============================================================ */
console.log(`\n==============================`);
console.log(`RESULTADO: ${passou}/${total} testes passaram`);
if (falhas.length) {
    console.log('FALHAS:');
    falhas.forEach(f => console.log(`  - ${f.descricao}: ${f.erro}`));
    process.exitCode = 1;
} else {
    console.log('Todos os testes passaram. ✅');
}