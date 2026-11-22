# Úteis Studio

Site rápido, moderno (tema escuro padrão + claro), instalável como **PWA** no celular e **100% client-side** (nenhuma imagem é enviada para servidores):

- **Removedor de Fundo com IA** — 3 motores direto no navegador (`BRIA RMBG-1.4` Ultra Precisão, `MODNet` especialista em pessoas/retratos e `IS-Net` rápido com fallback automático), limpeza de bordas, pincel **Apagar / Restaurar** e troca de fundo (transparente, cores sólidas ou gradientes).
- **Posts para Igreja** — 15 templates prontos (*Jovens*, *Irmãs*, *Santa Ceia*, *Família* e *Campanha/Quarta*), acervo embutido com 18 fundos (12 artes + 6 degradês), 4 layouts estruturais, 4 estilos de cards e data, editor interativo estilo Canva (arrastar, redimensionar nos cantos e guias de centralização) e **Perfil da Igreja** salvo no navegador com **Exportar / Importar (.json)**.
- **Recortar & Redimensionar** — proporções prontas (`1:1`, `16:9`, `9:16`, `4:3`, `4:5`), girar, espelhar e redimensionamento exato em pixels.
- **Comprimir & Converter** — envio em lote, controle de qualidade e conversão entre WebP, JPG e PNG.

## Rodar localmente

```powershell
npm.cmd install
npm.cmd run dev
```

Antes de publicar alterações, sempre valide o build:

```powershell
npm.cmd run build
```

---

## Opções para publicar de graça

Como o projeto é 100% estático (sem backend, banco de dados ou chaves de API), não há risco de cobrança surpresa.

### Opção 1: Vercel (Recomendado para uso pessoal / igreja)
- **Limites do plano Hobby (grátis):** até 200 projetos, 100 GB de tráfego/mês, 100 deploys/dia, HTTPS automático. *Restrito a uso não comercial.*
- **Pelo GitHub:** suba o repositório no GitHub, acesse [vercel.com/new](https://vercel.com/new), importe o projeto e clique em **Deploy** (já está configurado em `vercel.json`).
- **Pelo terminal (sem GitHub):** rode `npx.cmd vercel --prod`.

### Opção 2: Cloudflare Pages (Alternativa gratuita sem limite de banda)
- **Vantagens:** tráfego **ilimitado** no plano gratuito, HTTPS automático e **permite uso comercial** sem precisar pagar.
- **Como publicar:**
  1. Suba o repositório no GitHub.
  2. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
  3. Selecione o repositório e configure:
     - **Framework preset:** `Vite`
     - **Build command:** `npm run build`
     - **Build output directory:** `dist`
  4. Clique em **Save and Deploy**.

### Opção 3: Netlify Drop (Arrastar e soltar, sem Git)
1. Rode `npm.cmd run build`.
2. Acesse [app.netlify.com/drop](https://app.netlify.com/drop) e arraste a pasta `dist/`.

---

## Cuidados em produção e manutenção
- **Backup do Perfil da Igreja:** os dados fixos (logo e fotos dos pastores) ficam no `localStorage` do navegador. Use o botão **Exportar Perfil** na aba *Perfil da Igreja* para salvar um backup `.json` e restaurar em outros aparelhos com **Importar Perfil**.
- **Celulares com pouca memória:** no Removedor de Fundo, caso o modo *Ultra (RMBG)* fique pesado em aparelhos mais antigos, use os modos *Pessoas* ou *Rápido*.
- **Novos fundos no acervo:** basta salvar a imagem `.jpg` em `public/assets/church/` e registrá-la em `CHURCH_BACKGROUNDS` no arquivo `src/utils/churchAssets.ts`.
- **Atualização do PWA:** em mudanças grandes futuras, incremente `CACHE_NAME` em `public/sw.js` (ex.: `uteis-studio-v2`).
