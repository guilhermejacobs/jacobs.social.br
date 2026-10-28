# jacobs.social.br

Site pessoal de Guilherme Jacobs. A home reúne Reels do Instagram, episódios do podcast e textos do Omelete. Tem ainda uma página de arquivo com filtros e uma página "Sobre".

O site é estático e não tem dependências: são só scripts em Node. Ele roda inteiro no GitHub:

- **De hora em hora**, o GitHub Actions busca conteúdo novo (`scripts/fetch.mjs`), salva em `data/` e, se houver novidade, gera e publica o site no GitHub Pages.
- O conteúdo antigo continua salvo em `data/`, então o arquivo cresce com o tempo, mesmo que as APIs só devolvam os posts mais recentes.

## Onde editar

| O quê | Arquivo |
|---|---|
| Bio, links das redes, URL da página de autor no Omelete | `site.config.json` |
| Foto | `src/assets/guilherme-jacobs.jpg` |
| Cores e fontes | `src/assets/styles.css` (variáveis no topo) |
| Adicionar um conteúdo à mão (ex.: um collab que não apareceu) | `data/manual.json` |

Dá para editar tudo pelo próprio site do GitHub (ícone de lápis). Ao salvar, o site é republicado em 1–2 minutos.

### Adicionar um conteúdo manualmente

Em `data/manual.json`:

```json
{
  "items": [
    {
      "source": "instagram",
      "title": "Collab com fulano sobre o Oscar",
      "url": "https://www.instagram.com/reel/XXXXXXXX/",
      "date": "2026-10-20",
      "image": "media/manual/collab-oscar.jpg"
    }
  ]
}
```

`source` pode ser `instagram`, `podcast` ou `omelete`. `image` é opcional. Pode ser um link ou um arquivo enviado para `public/media/manual/`.

## Configuração (uma vez só)

### 1. Repositório e GitHub Pages

1. Crie um repositório **público** chamado `jacobs.social.br` em github.com/guilhermejacobs e envie este código para ele.
2. Em **Settings → Pages**, em "Build and deployment", escolha **Source: GitHub Actions**.
3. Ainda em **Settings → Pages**, em "Custom domain", coloque `jacobs.social.br` e salve. Quando o DNS propagar, marque **Enforce HTTPS**.

### 2. DNS no Registro.br

No painel do Registro.br, abra o domínio, vá em **DNS → Editar zona** (se pedir, ative o "modo avançado") e crie:

| Tipo | Nome | Valor |
|---|---|---|
| A | (vazio) | 185.199.108.153 |
| A | (vazio) | 185.199.109.153 |
| A | (vazio) | 185.199.110.153 |
| A | (vazio) | 185.199.111.153 |
| AAAA | (vazio) | 2606:50c0:8000::153 |
| AAAA | (vazio) | 2606:50c0:8001::153 |
| AAAA | (vazio) | 2606:50c0:8002::153 |
| AAAA | (vazio) | 2606:50c0:8003::153 |
| CNAME | www | guilhermejacobs.github.io |

A propagação pode levar algumas horas.

### 3. Podcast (Spotify)

Escolha **uma** das opções:

- **API do Spotify (recomendado: os links abrem o episódio no Spotify).** Em developer.spotify.com/dashboard, crie um app (em "Redirect URI", qualquer endereço serve, ex. `https://jacobs.social.br`). Depois, no repositório, vá em **Settings → Secrets and variables → Actions** e crie os secrets `SPOTIFY_CLIENT_ID` e `SPOTIFY_CLIENT_SECRET` com os valores do app.
- **Feed RSS.** Se você tiver o link do RSS do podcast (fica no painel de quem hospeda o programa, como o Spotify for Creators), coloque-o em `podcast.rss` no `site.config.json`.

### 4. Omelete

Confira se `omelete.authorUrl` no `site.config.json` aponta para a sua página de autor. O script lê os links dessa página e só guarda as matérias cujo autor contém "Jacobs" (`omelete.authorMatch`).

### 5. Instagram

A Meta só libera os posts pela API para contas **profissionais** (Criador ou Empresa).

1. No app do Instagram: **Configurações → Tipo de conta e ferramentas → Mudar para conta profissional** (Criador).
2. Em developers.facebook.com, crie um app do tipo **Business** e adicione o produto **Instagram** → **API setup with Instagram login**.
3. Em "Generate access tokens", adicione a sua conta `@gjsix` e gere o token. Esse token já é de longa duração (60 dias).
4. Salve o token no secret `IG_ACCESS_TOKEN` do repositório.
5. **Renovação automática:** crie um token do GitHub em github.com/settings/personal-access-tokens, do tipo *fine-grained*, só para este repositório, com permissão **Secrets: Read and write**. Salve-o no secret `GH_PAT`. Toda semana o workflow "Renovar token do Instagram" gera um token novo e o salva no lugar do antigo.

Por padrão o site mostra só os **Reels** (`instagram.onlyReels`). Mude para `false` para incluir fotos e carrosséis.

**Collabs:** posts em que você foi convidado como colaborador e aceitou podem não vir pela API (isso depende da Meta). Se algum não aparecer, adicione-o em `data/manual.json`.

## Rodar localmente

```bash
node scripts/build.mjs --sample   # gera dist/ com dados de exemplo
npx serve dist
```

Para buscar os dados de verdade: `IG_ACCESS_TOKEN=... SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node scripts/fetch.mjs`.
