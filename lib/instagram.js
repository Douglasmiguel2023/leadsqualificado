const IG_APP_ID = '936619743392459';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function extractShortcode(url) {
  const match = String(url || '').match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!match) {
    throw new Error('URL de post inválida. Use o link de um post ou reel (ex.: https://www.instagram.com/p/Cxxxxxxx/).');
  }
  return match[1];
}

function shortcodeToMediaId(shortcode) {
  let id = 0n;
  for (const char of shortcode) {
    const index = BASE64_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Shortcode de post inválido.');
    id = id * 64n + BigInt(index);
  }
  return id.toString();
}

async function igFetch(path) {
  let res;
  try {
    res = await fetch(`https://i.instagram.com${path}`, {
      headers: {
        'x-ig-app-id': IG_APP_ID,
        'user-agent': USER_AGENT,
        accept: '*/*'
      },
      signal: AbortSignal.timeout(15000)
    });
  } catch (err) {
    throw new Error('Falha de rede ao contatar o Instagram. Verifique sua conexão.');
  }
  if (res.status === 429) {
    throw new Error(
      'O Instagram bloqueou temporariamente este IP (429). Rode o app na sua máquina local, aguarde alguns minutos ou use o modo manual.'
    );
  }
  if (res.status === 404) {
    throw new Error('Post não encontrado. Verifique se o link está correto e o post é público.');
  }
  if (!res.ok) {
    throw new Error(`O Instagram respondeu ${res.status}. Tente novamente ou use o modo manual.`);
  }
  return res.json();
}

async function fetchPost(shortcode) {
  const mediaId = shortcodeToMediaId(shortcode);
  const data = await igFetch(`/api/v1/media/${mediaId}/info/`);
  const item = data.items && data.items[0];
  if (!item) throw new Error('Não foi possível ler os dados deste post.');
  return {
    mediaId,
    shortcode,
    url: `https://www.instagram.com/p/${shortcode}/`,
    owner: item.user ? item.user.username : 'desconhecido',
    caption: item.caption && item.caption.text ? item.caption.text : '',
    likeCount: item.like_count || 0,
    commentCount: item.comment_count || 0,
    postedAt: item.taken_at ? new Date(item.taken_at * 1000).toISOString() : null
  };
}

async function fetchComments(mediaId, maxComments = 300) {
  const comments = [];
  let nextMaxId = null;
  for (let page = 0; page < 15 && comments.length < maxComments; page++) {
    const params = new URLSearchParams({ can_support_threading: 'true', permalink_enabled: 'false' });
    if (nextMaxId) params.set('next_max_id', nextMaxId);
    const data = await igFetch(`/api/v1/media/${mediaId}/comments/?${params.toString()}`);
    for (const c of data.comments || []) {
      comments.push({
        user: c.user && c.user.username ? c.user.username : 'desconhecido',
        text: c.text || '',
        likes: c.comment_like_count || 0,
        verified: Boolean(c.user && c.user.is_verified),
        isBusiness: Boolean(c.user && c.user.is_business),
        followers: (c.user && c.user.follower_count) || 0
      });
    }
    nextMaxId = data.next_max_id;
    if (!nextMaxId) break;
  }
  return comments;
}

async function fetchLikers(mediaId) {
  const data = await igFetch(`/api/v1/media/${mediaId}/likers/`);
  return (data.users || []).map(u => ({
    user: u.username,
    verified: Boolean(u.is_verified),
    isBusiness: Boolean(u.is_business),
    followers: u.follower_count || 0
  }));
}

module.exports = { extractShortcode, shortcodeToMediaId, fetchPost, fetchComments, fetchLikers };
