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

function cleanUsername(raw) {
  const username = String(raw || '')
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .split(/[/?]/)[0]
    .trim();
  if (!username || !/^[A-Za-z0-9._]{1,30}$/.test(username)) {
    throw new Error('Usuário inválido. Use o @ do perfil (ex.: @dseng.designer).');
  }
  return username;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(url, headers) {
  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error('Falha de rede ao contatar o Instagram. Verifique sua conexão.');
  }
  if (res.status === 429) {
    throw new Error(
      'O Instagram bloqueou temporariamente este IP (429). Rode o app na sua máquina local, aguarde alguns minutos ou use o modo manual.'
    );
  }
  if (res.status === 404) {
    throw new Error('Não encontrado no Instagram. Verifique se o link/@ está correto e é público.');
  }
  if (!res.ok) {
    throw new Error(`O Instagram respondeu ${res.status}. Tente novamente ou use o modo manual.`);
  }
  return res.json();
}

function publicHeaders(extra = {}) {
  return {
    'x-ig-app-id': IG_APP_ID,
    'user-agent': USER_AGENT,
    accept: '*/*',
    ...extra
  };
}

async function igFetch(path) {
  return request(`https://i.instagram.com${path}`, publicHeaders());
}

async function igWebFetch(path) {
  return request(`https://www.instagram.com${path}`, publicHeaders());
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

async function fetchProfile(username) {
  const data = await igWebFetch(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`);
  const user = data.data && data.data.user;
  if (!user) throw new Error(`Perfil @${username} não encontrado ou privado.`);
  return {
    userId: user.id,
    username: user.username,
    fullName: user.full_name || '',
    biography: user.biography || '',
    category: user.category_name || user.business_category_name || '',
    isBusiness: Boolean(user.is_business),
    isVerified: Boolean(user.is_verified),
    isPrivate: Boolean(user.is_private),
    followers: (user.edge_followed_by && user.edge_followed_by.count) || user.follower_count || 0,
    posts: ((user.edge_owner_to_timeline_media && user.edge_owner_to_timeline_media.edges) || [])
      .filter(e => e.node && !e.node.is_private)
      .map(e => ({
        shortcode: e.node.shortcode,
        likeCount: (e.node.edge_liked_by && e.node.edge_liked_by.count) || (e.node.edge_media_preview_like && e.node.edge_media_preview_like.count) || 0,
        commentCount: (e.node.edge_media_to_comment && e.node.edge_media_to_comment.count) || 0,
        caption:
          e.node.edge_media_to_caption && e.node.edge_media_to_caption.edges[0]
            ? e.node.edge_media_to_caption.edges[0].node.text
            : ''
      }))
  };
}

async function fetchFollowers(userId, sessionId, maxFollowers = 300) {
  const users = [];
  let maxId = null;
  while (users.length < maxFollowers) {
    const params = new URLSearchParams({ count: '33', search_surface: 'follow_list_page' });
    if (maxId) params.set('max_id', maxId);
    const data = await request(
      `https://i.instagram.com/api/v1/friendships/${userId}/followers/?${params.toString()}`,
      publicHeaders({ cookie: `sessionid=${sessionId}` })
    );
    for (const u of data.users || []) {
      users.push({
        username: u.username,
        fullName: u.full_name || '',
        isPrivate: Boolean(u.is_private),
        isVerified: Boolean(u.is_verified)
      });
    }
    maxId = data.next_max_id;
    if (!maxId) break;
  }
  return users.slice(0, maxFollowers);
}

module.exports = {
  extractShortcode,
  shortcodeToMediaId,
  cleanUsername,
  sleep,
  fetchPost,
  fetchComments,
  fetchLikers,
  fetchProfile,
  fetchFollowers
};
