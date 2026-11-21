# Úteis Studio

Site simples, rápido e 100% client-side com ferramentas úteis para imagens:

- **Removedor de Fundo com IA** (estilo Canva, roda direto no navegador via WebAssembly, com opção de fundo transparente, cor sólida ou gradiente e comparador antes/depois).
- **Recortar & Redimensionar** (proporções prontas como 1:1, 16:9, 9:16, 4:5, girar, espelhar e redimensionamento em pixels).
- **Comprimir & Converter** (envio em lote, controle de qualidade e conversão entre WebP, JPG e PNG).

## Rodar localmente

```bash
npm install
npm run dev
```

## Publicar de graça (Vercel ou Netlify)

Como o site não precisa de backend nem variáveis de ambiente, publicar leva menos de 2 minutos:

### Opção 1: Vercel (Recomendado)
1. Suba esta pasta para um repositório no **GitHub**.
2. Acesse [vercel.com](https://vercel.com), clique em **Add New Project** e selecione o repositório.
3. Clique em **Deploy** (a Vercel detecta Vite automaticamente).

### Opção 2: Netlify (Arrastar e soltar, sem Git)
1. Rode `npm run build` no seu computador.
2. Acesse [app.netlify.com/drop](https://app.netlify.com/drop).
3. Arraste a pasta `dist/` gerada e seu site estará no ar na hora.
