# 🎯 LeadFinder — Captação de Leads Qualificados no Instagram

Sistema de prospecção que analisa posts públicos do Instagram (comentários, curtidas e engajamento) e identifica **possíveis clientes com potencial de compra**, com score de qualificação por nicho.

## Como funciona

1. Você cola a **URL de um post ou reel público** (seu ou de um concorrente do seu nicho).
2. O app coleta os dados públicos do post: legenda, curtidas e comentários.
3. O motor de qualificação analisa cada comentário e atribui um **score de 0 a 100**:

| Sinal | Pontos |
|---|---|
| Intenção de compra (preço, orçamento, "quanto custa", "quero contratar") | +45 |
| Interesse declarado ("quero", "preciso", "me chama", "como funciona") | +25 |
| Menção a palavras-chave do nicho (logo, identidade visual, feed, site...) | +15 |
| Comentário com engajamento (curtidas no comentário) | +10 |
| Perfil business | +10 |
| Perfil verificado / com audiência (1k+ seguidores) | +5 |
| Curtiu o post | +5 |
| Fez uma pergunta | +5 |

4. Os leads aparecem classificados em **🔥 Quente (60+)**, **🟡 Morno (30–59)** e **❄️ Frio (<30)**, com filtros, histórico salvo e **exportação para CSV**.

## Rodando na sua máquina

```bash
npm install
npm start
```

Abra `http://localhost:3000`.

> **Importante:** rode localmente (IP residencial). Em servidores/nuvem, o Instagram costuma bloquear requisições com erro 429.

## Modo manual

Se a coleta automática for bloqueada, use a aba **✍️ Modo manual**: cole os comentários (um por linha, formato `usuario: comentario`), informe quem curtiu e clique em analisar. Há um botão **Carregar exemplo** para testar na hora.

Os comentários podem ser copiados de qualquer post público, ou coletados com ferramentas de exportação.

## Ajustando para o seu nicho

As palavras-chave padrão já vêm calibradas para **design gráfico / social media**. Na seção "Palavras-chave do nicho" você pode trocar por termos do seu mercado (ex.: `personal trainer, treino, consulta` para fitness).

## Limitações e uso responsável

- Usa apenas **dados públicos** e endpoints oficiais da interface web do Instagram, sem login.
- O Instagram pode limitar ou bloquear requisições automatizadas (429). O app trata isso com mensagens claras e oferece o modo manual como alternativa.
- Use para prospecção legítima: entre em contato de forma educada, respeite a LGPD e não envie spam.

## Stack

- Node.js + Express (sem build, sem banco — leads ficam em `data/leads.json`)
- Frontend em HTML/CSS/JS puro
