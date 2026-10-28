# jacobs.social.br — instruções para assistentes de IA

> `CLAUDE.md`, `AGENTS.md` e `GEMINI.md` têm o mesmo conteúdo (cada ferramenta de IA lê um deles). Ao editar um, copie para os outros dois.

Site pessoal de Guilherme Jacobs (crítico de cinema, editor-chefe do Omelete). O dono não é programador: explique em português simples, mostre o resultado (prints) antes de publicar e não mexa no que não foi pedido. O passo a passo para humanos está em `README.md` e `docs/guia-do-site.pdf`.

## Como funciona

- Site estático, **sem dependências**: só Node.js 20+ (`fetch` nativo). Não adicione frameworks nem pacotes npm sem pedir.
- `scripts/fetch.mjs` busca conteúdo novo e grava em `data/*.json`. `scripts/build.mjs` gera `dist/` a partir de `data/` + `site.config.json` + `src/assets/`.
- `.github/workflows/site.yml` roda de hora em hora (e a cada push na `main`): fetch → commit dos dados → build → deploy no GitHub Pages. Domínio: `jacobs.social.br` (DNS no Registro.br).
- `data/*.json` acumula o histórico (o arquivo cresce mesmo quando as APIs só devolvem o recente). Não apague itens desses arquivos para escondê-los: use a lista `hide` do `site.config.json`, senão o robô os traz de volta.

## Fontes de conteúdo (`scripts/sources/`)

| Fonte | Como | Observações |
|---|---|---|
| Podcast *De Quinta* | RSS do Spotify for Creators (`podcast.rss`) | Sem senha. Se existirem `SPOTIFY_CLIENT_ID/SECRET`, usa a API do Spotify. |
| Instagram (@gjsix) | Graph API com login do Facebook: `graph.facebook.com/{IG_USER_ID}/media` com token de Página | Só Reels (`onlyReels`). Collabs publicados por outras contas **não** vêm pela API, e o dono decidiu não incluí-los. A Meta exige reautorizar a cada ~90 dias (lembrete na agenda do dono). |
| Omelete | `author-page.mjs`: lê a página de autor + o endpoint do "Ver Mais" (`/_scroll/autores/...?next=<timestamp>`) | Filtra pelo `content_type` que o Omelete põe em `gptKeys` na página: entram `review`, `article` e `list` (`omelete.includeTypes`). Notícias (`news`) ficam de fora por decisão do dono. |
| IndieWire | Feed RSS de autor do WordPress (`/author/guilherme-jacobs/feed/`) | Se o feed falhar, cai para a leitura da página de autor. |
| Manual | `data/manual.json` | TikTok, collabs ou textos de outros sites, adicionados à mão. |

A home tem três blocos: **Podcasts**, **Social** e **No Omelete e além**. O mapeamento fonte → bloco fica em `SOURCES`/`GROUPS`, em `scripts/build.mjs`.

## Cuidados

- **Classes CSS sem a palavra "social"**: bloqueadores de anúncio (o dono usa o Brave) escondem esses elementos. O grupo `social` usa a classe `clips` (`classOf()` no build); as redes usam `redes`, `redes-topo` e `redes-big`.
- **Modo noturno é o padrão** (`data-theme="dark"` no `<html>`); o botão do topo salva a escolha no `localStorage`. As cores ficam em variáveis no topo de `src/assets/styles.css`, com um bloco para cada tema.
- **Segredos** (`IG_ACCESS_TOKEN`, `IG_USER_ID`, opcionais `SPOTIFY_*` e `GH_PAT`) ficam só nos Secrets do GitHub. Nunca os grave em arquivos nem os peça ao dono no chat. Mensagens de erro não podem incluir URLs com token (`get()` em `scripts/lib.mjs` já remove a query).
- Os textos visíveis do site e os commits são em português.

## Testar antes de publicar

```bash
node scripts/build.mjs --sample   # dados de exemplo (fixtures/), sem rede
node scripts/build.mjs            # dados reais de data/
npx serve dist                    # ou: python3 -m http.server --directory dist
```

Confira desktop e celular (390 px), modo noturno e claro, e que a página não tenha rolagem horizontal. Para testar uma fonte sem acesso à rede, simule `fetch` com `node --import <mock>.mjs` e restaure `data/` depois.

**Se o seu ambiente não acessar Omelete, Spotify, IndieWire ou Meta** (comum em ambientes de IA na nuvem), use o próprio GitHub Actions: crie uma branch temporária com um workflow que rode um script de diagnóstico e faça commit do resultado na branch, depois leia o resultado com `git pull`. Nunca grave tokens nesse resultado. Ao terminar, peça ao dono para apagar a branch em github.com/guilhermejacobs/jacobs.social.br/branches.

## Documentação

Ao mudar algo que o dono precise saber (configuração, secrets, comportamento), atualize o `README.md` e, se possível, o `docs/guia-do-site.pdf`.
