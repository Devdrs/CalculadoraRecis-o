# Calculadora Trabalhista — Casa Contábil

## Objetivo
Simular verbas rescisórias (saldo de salário, aviso-prévio, 13º proporcional,
férias vencidas/proporcionais, DSR, multa de FGTS) com memória de cálculo
completa, a partir das fórmulas definidas no documento-base da Casa Contábil.

## Arquitetura
Módulos ES nativos (`<script type="module">`), sem bundler e sem dependências
externas. **Funciona servido por HTTP(S) (GitHub Pages, por exemplo) — não
abra o `calculadora-trabalhista.html` direto como arquivo local (`file://`),
pois navegadores bloqueiam `import` de módulos por CORS nesse protocolo.**
Para testar localmente, rode um servidor simples, por exemplo:
`python3 -m http.server 8000` na pasta do projeto, e acesse
`http://localhost:8000/calculadora-trabalhista.html`.

```
calculadora-trabalhista.html   → interface (wizard de 3 etapas)
css/
  style.css                     → tokens (cinza/branco/neutro + dourado discreto) e layout
  components.css                → resumo, total, memória de cálculo, pendências, lead
  responsive.css                 → breakpoints 980px/640px
js/
  app.js                         → orquestrador: eventos, localStorage, WhatsApp
  models/contrato.js              → objeto central do vínculo empregatício
  calculations/
    saldoSalario.js | avisoPrevio.js | ferias.js | decimoTerceiro.js
    fgts.js | medias.js | dsr.js | descontos.js | rescisao.js (orquestrador dos cálculos)
  rules/regrasTrabalhistas.js      → ÚNICO lugar com: tipos de desligamento,
                                      parâmetros configuráveis (CONFIG_REGRAS),
                                      matriz de elegibilidade por tipo, e a lista
                                      de pendências jurídicas exibida na tela
  validators/validacoes.js          → validações puras (sem tocar no DOM)
  ui/form.js | ui/results.js | ui/memoryCalculation.js → só manipulam o DOM
tests/testes.js                   → suíte automatizada (node tests/testes.js)
```

**Princípio seguido à risca:** a interface nunca calcula nada. Toda fórmula
mora em `calculations/`; `app.js` só liga validação → cálculo → exibição.

## Como alterar uma regra
Praticamente tudo está em `js/rules/regrasTrabalhistas.js`:
- Um percentual ou prazo → `CONFIG_REGRAS`.
- Quais verbas cabem em cada tipo de rescisão → `MATRIZ_ELEGIBILIDADE`.
- Avisos/limitações mostrados na tela → `PENDENCIAS_GERAIS`.
Nenhuma dessas mudanças exige tocar em `calculations/` ou na interface.

## Como adicionar uma nova verba
1. Crie `js/calculations/novaVerba.js` com uma função `calcularNovaVerba(contrato, variaveis)`
   que devolve `{ id, nome, aplicavel, valor, formula, descricao, dadosUtilizados }`.
2. Importe e chame essa função em `calculations/rescisao.js`, somando ao
   `totalBruto` ou `totalDescontos` conforme o caso.
3. Pronto — `ui/results.js` e `ui/memoryCalculation.js` já renderizam
   automaticamente qualquer item da lista `resultado.itens`.

## Como ativar o INSS/IRRF quando a tabela for definida
Edite apenas `js/calculations/descontos.js` (`calcularINSS`/`calcularIRRF`):
hoje elas sempre retornam `pendente: true` e valor 0, de propósito, porque a
documentação-base não trouxe a tabela de alíquotas vigente. Nenhum outro
módulo precisa mudar.

## Como criar novos testes
Edite `tests/testes.js` (sem framework — só funções `testar()`/`assert()`) e
rode `node tests/testes.js`. O arquivo importa direto os módulos de cálculo,
então qualquer cenário novo é só chamar `calcularRescisao({...})` com os
dados desejados e comparar o resultado.

## Como alterar a identidade visual
Os tokens de cor ficam em `css/style.css` (bloco `:root`, prefixo `--tb-`).
A paleta pedida é cinza/branco/neutro escuro com dourado discreto (reaproveita
`--gold` do site principal) — **sem verde como cor principal**.

## Como adicionar um novo tipo de desligamento
1. Adicione o identificador em `TIPOS_DESLIGAMENTO` (`rules/regrasTrabalhistas.js`).
2. Adicione sua linha na `MATRIZ_ELEGIBILIDADE`.
3. Adicione a `<option>` correspondente no `<select id="tipoDesligamento">` do HTML.
Nenhum módulo de cálculo precisa ser alterado — todos já leem a matriz.