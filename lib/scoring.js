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
const CONTACT_SIGNALS = /(orcamento|encomenda|encomendas|agende|agendamento|agenda aberta|whats|whatsapp|link na bio|chama no direct|chama na dm|contato|atendimento|compre|vendas|pedidos)/;
const BUSINESS_TYPE = /(loja|lojinha|boutique|atelier|ateli[eê]|studio|st[uú]dio|sal[aã]o|cl[ií]nica|consult[oó]rio|empresa|pizzaria|hamburgueria|lanchonete|cafeteria|restaurante|barbearia|pet ?shop|academia|marcenaria|confeitaria|doceria|floricultura|[oó]tica|farm[aá]cia|mercado|padaria|advocacia|arquitetura|im[oó]vel|imobili[aá]ria)/;

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

function scoreProfileLead(profile, nicheKeywords) {
  const haystack = normalize([profile.biography, profile.fullName, profile.category].join(' '));
  const tags = [];
  let score = 0;

  const matchedKeywords = nicheKeywords.filter(kw => haystack.includes(normalize(kw)));
  if (matchedKeywords.length > 0) {
    score += 20;
    tags.push(`Atua no nicho: ${matchedKeywords.slice(0, 3).join(', ')}`);
  }
  if (profile.isBusiness || profile.category) {
    score += 10;
    tags.push(profile.category ? `Categoria: ${profile.category}` : 'Perfil business');
  }
  if (profile.followers >= 300 && profile.followers <= 100000) {
    score += 15;
    tags.push('Porte ideal para contratar');
  }
  if (CONTACT_SIGNALS.test(haystack)) {
    score += 15;
    tags.push('Canal de contato aberto');
  }
  if (BUSINESS_TYPE.test(haystack)) {
    score += 12;
    tags.push('Negócio identificado (possível cliente)');
  }
  if (profile.isVerified) {
    score += 5;
    tags.push('Perfil verificado');
  }
  if (profile.isPrivate) {
    score -= 10;
    tags.push('Perfil privado');
  }

  score = Math.max(0, score);
  const level = score >= 60 ? 'quente' : score >= 30 ? 'morno' : 'frio';
  return {
    type: 'perfil',
    user: profile.username,
    fullName: profile.fullName,
    text: profile.biography || profile.fullName || '(sem bio)',
    followers: profile.followers,
    category: profile.category,
    isPrivate: profile.isPrivate,
    score,
    tags,
    level,
    analyzedAt: new Date().toISOString()
  };
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

module.exports = { DEFAULT_NICHE_KEYWORDS, analyzeComments, scoreLead, scoreProfileLead };
