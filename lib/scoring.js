const DEFAULT_NICHE_KEYWORDS = [
  'logo',
  'identidade visual',
  'marca',
  'feed',
  'instagram',
  'arte',
  'artes',
  'design',
  'designer',
  'social media',
  'post',
  'posts',
  'criativo',
  'criativos',
  'site',
  'landing page',
  'carrossel',
  'stories',
  'flyer',
  'cardapio',
  'banner',
  'convite',
  'trabalho',
  'servico'
];

const BUY_INTENT = /(quanto custa|quanto sai|quanto fica|qual o valor|qual valor|valor do|valor pra|orcamento|faz orcamento|passa orcamento|preco|investimento|quero contratar|quero fechar|fechado|forma de pagamento|como pago|fatura|proposta)/;
const INTEREST = /(quero|preciso|tenho interesse|interessad|como funciona|me chama|chama no direct|chama no dm|me manda|manda msg|me adiciona|pode me ajudar|faz pra mim|faz para mim|to precisando|estou precisando|gostei|top|perfeito|quero um|quero essa|quero esse)/;

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function scoreLead(comment, context, nicheKeywords) {
  const text = normalize(comment.text);
  const tags = [];
  let score = 0;

  if (BUY_INTENT.test(text)) {
    score += 45;
    tags.push('Intenção de compra');
  }
  if (INTEREST.test(text)) {
    score += 25;
    tags.push('Interesse declarado');
  }
  const matchedKeywords = nicheKeywords.filter(kw => text.includes(normalize(kw)));
  if (matchedKeywords.length > 0) {
    score += 15;
    tags.push(`Nicho: ${matchedKeywords.slice(0, 3).join(', ')}`);
  }
  if (text.includes('?')) {
    score += 5;
    tags.push('Pergunta');
  }
  if ((comment.likes || 0) >= 3) {
    score += 10;
    tags.push('Comentário com engajamento');
  }
  if (context.likers && context.likers.has(comment.user)) {
    score += 5;
    tags.push('Curtiu o post');
  }
  if (comment.isBusiness) {
    score += 10;
    tags.push('Perfil business');
  }
  if (comment.verified) {
    score += 5;
    tags.push('Perfil verificado');
  }
  if ((comment.followers || 0) >= 1000) {
    score += 5;
    tags.push('Perfil com audiência');
  }

  const level = score >= 60 ? 'quente' : score >= 30 ? 'morno' : 'frio';
  return { score, tags, level };
}

function analyzeComments(comments, options = {}) {
  const nicheKeywords = (options.nicheKeywords && options.nicheKeywords.length > 0)
    ? options.nicheKeywords
    : DEFAULT_NICHE_KEYWORDS;
  const likers = new Set((options.likers || []).map(l => l.user));

  const seen = new Set();
  const leads = [];
  for (const comment of comments) {
    const key = `${comment.user}::${normalize(comment.text)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { score, tags, level } = scoreLead(comment, { likers }, nicheKeywords);
    leads.push({
      user: comment.user,
      text: comment.text,
      likes: comment.likes || 0,
      score,
      tags,
      level,
      analyzedAt: new Date().toISOString()
    });
  }
  leads.sort((a, b) => b.score - a.score || b.likes - a.likes);
  return leads;
}

module.exports = { DEFAULT_NICHE_KEYWORDS, analyzeComments, scoreLead };
