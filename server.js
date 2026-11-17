const fs = require('fs');
const path = require('path');
const express = require('express');
const { extractShortcode, fetchPost, fetchComments, fetchLikers } = require('./lib/instagram');
const { DEFAULT_NICHE_KEYWORDS, analyzeComments } = require('./lib/scoring');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

fs.mkdirSync(DATA_DIR, { recursive: true });

function readLeads() {
  try {
    return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeLeads(leads) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

function parseKeywords(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,\n]/)
    .map(k => k.trim())
    .filter(Boolean);
}

function parseManualComments(raw) {
  return String(raw || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) return { user: 'desconhecido', text: line, likes: 0 };
      return {
        user: line.slice(0, separatorIndex).trim() || 'desconhecido',
        text: line.slice(separatorIndex + 1).trim(),
        likes: 0
      };
    });
}

app.get('/api/keywords', (req, res) => {
  res.json({ keywords: DEFAULT_NICHE_KEYWORDS });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const shortcode = extractShortcode(req.body.url);
    const nicheKeywords = parseKeywords(req.body.keywords);
    const post = await fetchPost(shortcode);
    const [comments, likers] = await Promise.all([
      fetchComments(post.mediaId).catch(() => []),
      fetchLikers(post.mediaId).catch(() => [])
    ]);
    const leads = analyzeComments(comments, { nicheKeywords, likers });
    res.json({ post, totalComments: comments.length, totalLikers: likers.length, leads });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/analyze-manual', (req, res) => {
  try {
    const nicheKeywords = parseKeywords(req.body.keywords);
    const comments = parseManualComments(req.body.comments);
    if (comments.length === 0) {
      return res.status(400).json({ error: 'Cole pelo menos um comentário (formato: usuario: comentario).' });
    }
    const likers = String(req.body.likers || '')
      .split(/[,\n]/)
      .map(u => u.trim().replace(/^@/, ''))
      .filter(Boolean)
      .map(u => ({ user: u }));
    const leads = analyzeComments(comments, { nicheKeywords, likers });
    res.json({
      post: {
        owner: req.body.owner || 'post manual',
        caption: req.body.caption || '',
        likeCount: null,
        commentCount: comments.length
      },
      totalComments: comments.length,
      totalLikers: likers.length,
      leads
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/leads', (req, res) => {
  res.json({ leads: readLeads() });
});

app.post('/api/leads', (req, res) => {
  const incoming = Array.isArray(req.body.leads) ? req.body.leads : [];
  const existing = readLeads();
  const seen = new Set(existing.map(l => `${l.user}::${l.text}`));
  const merged = existing.concat(incoming.filter(l => !seen.has(`${l.user}::${l.text}`)));
  merged.sort((a, b) => b.score - a.score);
  writeLeads(merged);
  res.json({ leads: merged });
});

app.delete('/api/leads', (req, res) => {
  writeLeads([]);
  res.json({ leads: [] });
});

app.get('/api/export', (req, res) => {
  const leads = readLeads();
  const header = 'usuario;nivel;score;comentario;curtidas;tags;data_analise';
  const rows = leads.map(l =>
    [l.user, l.level, l.score, String(l.text).replace(/[\r\n;]/g, ' '), l.likes || 0, (l.tags || []).join(' | '), l.analyzedAt]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(';')
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="leads-qualificados.csv"');
  res.send('\ufeff' + [header].concat(rows).join('\n'));
});

app.listen(PORT, () => {
  console.log(`LeadFinder rodando em http://localhost:${PORT}`);
});
