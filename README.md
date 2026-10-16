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

Crie um arquivo `.env` na raiz do projeto e configure a chave da API:

```env
API_KEY=sua_chave_da_api
```

O arquivo `.env` é ignorado pelo Git. **Não inclua chaves ou outros segredos em commits.** A chave é lida no servidor e não é armazenada no navegador nem enviada pelo cliente.

Inicie o servidor de desenvolvimento:

```sh
npm run dev
```

Por padrão, o Vite inicia o projeto em `http://localhost:8080`.

## Configurar a integração

No dashboard, acesse **Configuração** para informar a função da API E-SHIP e os parâmetros da consulta. A configuração é salva no armazenamento local do navegador. Para habilitar ou pausar as consultas automáticas, use a opção correspondente nessa página.

A chave da API deve permanecer no servidor:

- **Desenvolvimento local:** variável `API_KEY` no arquivo `.env`.
- **Vercel:** variável `API_KEY` em **Project Settings → Environment Variables**. Depois de salvar a variável, faça uma nova implantação.

O servidor também aceita `ESHIP_API_KEY` para compatibilidade com configurações antigas.

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
