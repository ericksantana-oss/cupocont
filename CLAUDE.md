# CupoCont

Ferramenta interna da Cupola para produção de conteúdo. A agência atende
**exclusivamente clientes do mercado imobiliário** — todo exemplo, prompt e
material do projeto deve usar contexto imobiliário, nunca outro segmento.

## Documentação viva — manter atualizada

A pasta `docs/` é a memória do projeto. **Consultar antes de agir e atualizar
ao longo do trabalho**, não só quando pedirem:

| Arquivo | Quando ler | Quando atualizar |
|---|---|---|
| `docs/decisoes.txt` | Antes de propor mudança de rumo | Decisão tomada ou revertida |
| `docs/pendencias.txt` | Antes de planejar próximos passos | Pendência resolvida ou criada |
| `docs/aprendizados.txt` | **Antes de mexer nas APIs do Meta ou da Anthropic** | Comportamento inesperado descoberto |
| `docs/operacao.txt` | Na hora de rodar migration ou deploy | O jeito de operar mudar |

Regras de escrita:

- Sempre com data.
- Registrar o **porquê**, não só o quê — o motivo é o que evita revisitar.
- Registrar o que foi **descartado** e por quê. Metade do valor está em não
  refazer o caminho que já se mostrou errado.
- Pendência resolvida **migra** para `decisoes.txt` com o desfecho, não some.
- Decisão revertida é **marcada como revertida**, com data e motivo. Nunca
  reescrever a história.

`docs/aprendizados.txt` é o mais caro de reconstruir: cada item ali custou
horas de investigação. Vale mais uma linha a mais do que uma a menos.

## Armadilhas que já custaram caro

Detalhe completo em `docs/aprendizados.txt`. As que mais mordem:

- **Migrations** vão pelo *session pooler* (porta 5432). O *transaction
  pooler* trava o comando sem erro. A aplicação em runtime é o contrário:
  transaction pooler (6543 + `pgbouncer=true`), porque o session pooler estoura
  em 15 conexões e já derrubou a produção.
- **O SDK da Anthropic já tem retentativa própria** (`maxRetries: 2`). Em cima do
  laço do `llm.ts` as duas camadas se multiplicam: uma chamada de 35s virou 805s.
  O cliente é criado com `maxRetries: 0` de propósito — não mexer sem ler o
  comentário lá.
- **Timeout da IA é orçamento TOTAL, não por tentativa** (`ORCAMENTO_MS`, 55s),
  porque a função na Vercel morre em 60s. A geração de 20 temas leva ~35s medidos.
- **O Meta não expõe a fila de agendamento do Business Suite.** Já foi
  investigado a fundo; não tentar de novo.
- **`fetch` é cacheado por padrão no Next 14.** Em tela que mostra estado atual,
  desligar com `dynamic = "force-dynamic"` e `fetchCache = "force-no-store"`.

## Verificação antes de publicar

```bash
npx tsc --noEmit -p .
```

O `next build` pega o que o typecheck não pega. Se uma rota foi apagada, limpar
`.next` antes — os tipos gerados ficam para trás e acusam erro fantasma.
