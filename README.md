# Painel WMS

Dashboard para acompanhar ordens e filas da operação logística por meio da API E-SHIP. A interface foi preparada para telas de TV e também se adapta a computadores, tablets e smartphones.

Aplicação publicada: [painelwms.vercel.app](https://painelwms.vercel.app)

## Recursos

- Acompanhamento do valor total e da quantidade de pedidos.
- Cartões interativos para filtrar as ordens por status sem repetir a consulta à API a cada seleção.
- Gráficos de pedidos e valores de frete por status.
- Distribuição das ordens por estado do destinatário, com quantidade e valor.
- Resumo das filas por família, com pesquisa.
- Atualização automática dos dados a cada 2 minutos.
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

No dashboard principal, a rotação automática dos cartões de status começa 20 segundos após a abertura da página. Em seguida, cada status fica selecionado por 15 segundos, em ciclo contínuo. Os dados são carregados uma vez e os filtros são aplicados localmente.

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
