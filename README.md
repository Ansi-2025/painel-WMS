# Painel WMS

Dashboard para acompanhar ordens e filas da operação logística por meio da API E-SHIP. A interface foi preparada para telas de TV e também se adapta a computadores, tablets e smartphones.

Aplicação publicada: [painelwms.vercel.app](https://painelwms.vercel.app)

## Recursos

- Acompanhamento do valor total e da quantidade de pedidos.
- Cartões interativos para filtrar as ordens por status sem repetir a consulta à API a cada seleção.
- Gráficos de pedidos e valores de frete por status.
- Gráfico de ordens por tempo de criação, das últimas 24 horas a mais de 30 dias; ordens sem data válida não são exibidas.
- Distribuição das ordens por estado do destinatário, com quantidade e valor.
- Resumo das filas por família, com pesquisa.
- Atualização automática dos dados a cada 2 minutos.
- O dashboard principal consulta somente o armazém BRANCO01.
- O módulo Inventário acompanha o plano ativo do BRANCO01, permite pesquisar itens por código, descrição, endereço, depósito ou status, separar a tabela por produto ou posição, identifica peças e produtos, oferece links dos documentos/imagens cadastrados na planilha local e agrupa posições por rua.
- O resumo mostra o valor das ordens canceladas no dia, pela data da última atualização da ordem no fuso de Fortaleza.
- O cartão “Integração do dia” soma quantidade e valor usando o período de lançamento “Hoje” (10004), os tipos de ordem `[12,10,20,14,4,13,6,2]` e os status `[6,5,8,4,7,3,2,1]`, incluindo também o status 10 (Cancelado), no armazém BRANCO01. Consulta ao abrir/conectar e atualiza os dados a cada hora.
- A consulta padrão do dashboard usa os tipos de ordem Montagem, Suframa, Difal, Agendamento, SAC e Ecommerce, conforme os filtros do WMS.
- As contagens consideram apenas ordens com o campo “Valor da ordem” preenchido, como no relatório atual do WMS.
- Navegação adaptada para celular, tablet, computador e TV.

## Requisitos

- Node.js
- npm

## Executar localmente

Instale as dependências:

```sh
npm install --no-package-lock
```

Crie um arquivo `.env` na raiz do projeto e configure a chave da API e a senha de acesso ao painel:

```env
API_KEY=sua_chave_da_api
USER_CONTROLER=sua_senha_de_acesso
```

O arquivo `.env` é ignorado pelo Git. **Não inclua chaves ou outros segredos em commits.** A chave da API e a senha são lidas somente no servidor e não são armazenadas no navegador nem enviadas ao cliente.

Inicie o servidor de desenvolvimento:

```sh
npm run dev
```

Por padrão, o Vite inicia o projeto em `http://localhost:8080`.

## Configurar a integração

No dashboard, acesse **Configuração** para informar a função da API E-SHIP e os parâmetros da consulta. A configuração é salva no armazenamento local do navegador. Para habilitar ou pausar as consultas automáticas, use a opção correspondente nessa página.

A chave da API deve permanecer no servidor:

- **Desenvolvimento local:** variáveis `API_KEY` e `USER_CONTROLER` no arquivo `.env`.
- **Vercel:** variáveis `API_KEY` e `USER_CONTROLER` em **Project Settings → Environment Variables**. Depois de salvar ou alterar as variáveis, faça uma nova implantação.

O servidor também aceita `ESHIP_API_KEY` para compatibilidade com configurações antigas. A variável `USER_CONTROLER` define a senha única do login do painel. Após entrar, a sessão permanece válida por até 12 horas; é possível encerrá-la pelo botão **Sair**.

## Exibição automática por status

No dashboard principal, a rotação automática dos cartões de status começa 20 segundos após a abertura da página. Cada status fica selecionado por 15 segundos. Depois do último status, o filtro é limpo e todos ficam visíveis por 20 segundos; em seguida, os cinco primeiros status (Lançados, Emitido, Em operação, Conferida e Ag. Documentação) são selecionados juntos por mais 20 segundos, antes do ciclo recomeçar. Os dados são carregados uma vez e os filtros são aplicados localmente.

## Modelo para criar módulos

Os módulos de consulta usam o componente compartilhado `PainelModulo`, que mantém o mesmo layout, filtros, atualização automática e visualizações. Cada módulo fornece seu título, subtítulo e função de consulta; a configuração da consulta tem o formato `{ funcao, parametros }`, validado por `ConsultaEshipSchema`.

### Módulos personalizados pela configuração

O fluxo já implementado para módulos personalizados pode ser usado como referência:

1. `ModuloPersonalizadoSchema` define e valida os campos `id` (UUID), `nome` (até 40 caracteres), `funcao` e `parametros`.
2. `salvarModuloPersonalizado`, `listarModulosPersonalizados`, `buscarModuloPersonalizado` e `removerModuloPersonalizado`, em `src/lib/wms-config.ts`, gerenciam os módulos no `localStorage` do navegador.
3. `BarraModulos`, em `src/components/BarraModulos.tsx`, assina as alterações e inclui os módulos salvos na navegação.
4. A rota `src/routes/modulo.$id.tsx` localiza o módulo pelo ID e renderiza `PainelModulo` com `consultarFuncao` e a consulta inicial salva.

### Adicionar uma nova origem ou função de consulta

1. Defina os dados e os parâmetros esperados pela integração, reutilizando ou estendendo os schemas em `src/lib/wms-config.ts`.
2. Implemente a consulta do lado do servidor em `src/lib/wms.functions.ts`. Valide os parâmetros com o schema, exija uma sessão autenticada e mantenha chaves e chamadas externas somente no servidor.
3. Garanta que a função retorne `ordens: OrdemWMS[]`. Se disponíveis, ela também pode retornar `statusPedidos`, `fretesPorStatus`, `quantidadeCanceladasHoje`, `valorCanceladasHoje`, `quantidadeIntegradasHoje` e `valorIntegradasHoje`.
4. Renderize `PainelModulo` passando `titulo`, `subtitulo` e a função em `consultar`. Passe `consultaInicial` quando o módulo tiver parâmetros próprios e `exibirGraficos` quando os gráficos do dashboard forem pertinentes.
5. Para uma página permanente, crie uma rota em `src/routes/` e adicione sua navegação em `MODULOS`, em `src/components/BarraModulos.tsx`. Para módulos criados pelo usuário, reutilize o armazenamento, a rota dinâmica e a navegação descritos acima.

Depois de adicionar um módulo, valide a integração com `npm run build` e `npm run lint`.

## Verificações

Gerar a compilação de produção:

```sh
npm run build
```

Executar o ESLint:

```sh
npm run lint
```

Visualizar localmente a compilação:

```sh
npm run preview
```
