const state = { leads: [], filter: 'todos' };

const $ = id => document.getElementById(id);

function showAlert(message) {
  const alert = $('alert');
  alert.textContent = '⚠️ ' + message;
  alert.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function hideAlert() {
  $('alert').classList.add('hidden');
}

function levelEmoji(level) {
  return level === 'quente' ? '🔥' : level === 'morno' ? '🟡' : '❄️';
}

function renderLeads(container, leads) {
  if (!leads.length) {
    container.innerHTML = '<p class="empty">Nenhum lead encontrado.</p>';
    return;
  }
  container.innerHTML = leads
    .map(lead => {
      const meta = [];
      if (lead.type === 'perfil') {
        if (lead.followers != null) meta.push(`👥 ${Number(lead.followers).toLocaleString('pt-BR')} seguidores`);
        if (lead.fullName) meta.push(lead.fullName);
      } else if (lead.likes) {
        meta.push(`❤️ ${lead.likes} curtidas no comentário`);
      }
      return `
      <div class="lead ${lead.level}">
        <div class="score">${lead.score}<small>pts</small></div>
        <div class="lead-body">
          <div class="lead-top">
            <span class="user">@${escapeHtml(lead.user)}</span>
            <span class="level">${levelEmoji(lead.level)} ${lead.level}</span>
          </div>
          ${meta.length ? `<p class="lead-meta">${meta.map(escapeHtml).join(' • ')}</p>` : ''}
          <p class="lead-text">${escapeHtml(lead.text)}</p>
          <div class="tags">${(lead.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
        </div>
      </div>`;
    })
    .join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

function renderStats(leads) {
  const hot = leads.filter(l => l.level === 'quente').length;
  const warm = leads.filter(l => l.level === 'morno').length;
  const cold = leads.filter(l => l.level === 'frio').length;
  $('stats').innerHTML = `
    <span class="stat-pill">Total: ${leads.length}</span>
    <span class="stat-pill">🔥 Quentes: ${hot}</span>
    <span class="stat-pill">🟡 Mornos: ${warm}</span>
    <span class="stat-pill">❄️ Frios: ${cold}</span>`;
}

function showResults(data) {
  state.leads = data.leads || [];
  state.filter = 'todos';
  document.querySelectorAll('.filter').forEach(b => b.classList.toggle('active', b.dataset.filter === 'todos'));

  const post = data.post || {};
  const profile = data.profile;
  const owner = profile ? profile.username : post.owner;
  const boxes = [];
  boxes.push(`<div class="stat-box"><div class="value">${owner ? '@' + escapeHtml(owner) : '—'}</div><div class="label">Perfil</div></div>`);
  if (profile) {
    boxes.push(`<div class="stat-box"><div class="value">${profile.followers ? profile.followers.toLocaleString('pt-BR') : '—'}</div><div class="label">Seguidores</div></div>`);
    boxes.push(`<div class="stat-box"><div class="value">${data.mode === 'followers' ? (data.profilesAnalyzed ?? '—') : (data.totalComments ?? '—')}</div><div class="label">${data.mode === 'followers' ? 'Perfis analisados' : 'Comentários analisados'}</div></div>`);
    if (profile.category) boxes.push(`<div class="stat-box"><div class="value" style="font-size:14px">${escapeHtml(profile.category)}</div><div class="label">Categoria</div></div>`);
  } else {
    boxes.push(`<div class="stat-box"><div class="value">${post.likeCount ?? '—'}</div><div class="label">Curtidas</div></div>`);
    boxes.push(`<div class="stat-box"><div class="value">${data.totalComments ?? post.commentCount ?? '—'}</div><div class="label">Comentários analisados</div></div>`);
    boxes.push(`<div class="stat-box"><div class="value">${data.totalLikers ?? '—'}</div><div class="label">Curtidas coletadas</div></div>`);
  }
  const caption = profile ? profile.biography : post.caption;
  const bioLabel = profile ? '📄 Bio' : '📝 Legenda';
  $('post-info').innerHTML = boxes.join('') + (caption ? `<p class="caption">${bioLabel} ${escapeHtml(String(caption).slice(0, 300))}${String(caption).length > 300 ? '...' : ''}</p>` : '');

  renderStats(state.leads);
  renderLeads($('leads-list'), state.leads);
  $('post-summary').classList.remove('hidden');
  $('results').classList.remove('hidden');
  hideAlert();
}

function applyFilter() {
  const filtered = state.filter === 'todos' ? state.leads : state.leads.filter(l => l.level === state.filter);
  renderLeads($('leads-list'), filtered);
}

async function analyzeAuto() {
  const url = $('post-url').value.trim();
  if (!url) return showAlert('Cole a URL de um post do Instagram.');
  const btn = $('btn-analyze');
  btn.disabled = true;
  btn.textContent = 'Analisando...';
  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, keywords: $('keywords').value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao analisar o post.');
    showResults(data);
  } catch (err) {
    showAlert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analisar';
  }
}

async function analyzeManual() {
  const comments = $('manual-comments').value.trim();
  if (!comments) return showAlert('Cole pelo menos um comentário.');
  const btn = $('btn-analyze-manual');
  btn.disabled = true;
  btn.textContent = 'Analisando...';
  try {
    const res = await fetch('/api/analyze-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comments,
        likers: $('manual-likers').value,
        caption: $('manual-caption').value,
        keywords: $('keywords').value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao analisar os comentários.');
    showResults(data);
  } catch (err) {
    showAlert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analisar comentários';
  }
}

async function saveLeads() {
  if (!state.leads.length) return showAlert('Nada para salvar ainda.');
  const res = await fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leads: state.leads })
  });
  const data = await res.json();
  state.saved = data.leads;
  renderSaved(data.leads);
  $('saved').classList.remove('hidden');
  hideAlert();
}

async function loadSaved() {
  try {
    const res = await fetch('/api/leads');
    const data = await res.json();
    if (data.leads && data.leads.length) {
      renderSaved(data.leads);
      $('saved').classList.remove('hidden');
    }
  } catch {}
}

function renderSaved(leads) {
  renderLeads($('saved-list'), leads.slice(0, 50));
}

async function clearSaved() {
  await fetch('/api/leads', { method: 'DELETE' });
  $('saved-list').innerHTML = '';
  $('saved').classList.add('hidden');
}

function loadDemo() {
  $('manual-likers').value = 'carla_mkt, rodrigo_pizzaria';
  $('manual-caption').value = 'Nova identidade visual que criamos para uma hamburgueria 🍔🔥 Chama no direct para um orçamento!';
  $('manual-comments').value = [
    'carla_mkt: Quanto custa uma identidade visual completa? Tenho uma lojinha de roupas',
    'rodrigo_pizzaria: quero um feed organizado pro meu negócio, me chama no dm',
    'julia_linda: top demais 😍',
    'marcos_adv: preciso de artes para minhas redes, como funciona o processo?',
    'pedro_fit: quanto sai um logo?',
    'ana_costureira: faz flyer pra minha loja? manda orçamento',
    'lucas_gamer: kkkk ficou brabo',
    'patricia_beleza: tenho interesse em social media pro meu salão, qual o valor?'
  ].join('\n');
  switchTab('manual');
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('panel-auto').classList.toggle('hidden', tab !== 'auto');
  $('panel-manual').classList.toggle('hidden', tab !== 'manual');
  $('panel-scan').classList.toggle('hidden', tab !== 'scan');
}

async function scanProfile() {
  const username = $('scan-username').value.trim();
  if (!username) return showAlert('Digite o @ do perfil que quer varrer.');
  const mode = $('scan-mode').value;
  const btn = $('btn-scan');
  btn.disabled = true;
  btn.textContent = 'Varrendo...';
  try {
    const res = await fetch('/api/scan-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        mode,
        keywords: $('keywords').value,
        maxPosts: $('scan-max-posts').value,
        maxProfiles: $('scan-max-profiles').value,
        sessionId: $('scan-sessionid').value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na varredura do perfil.');
    showResults(data);
  } catch (err) {
    showAlert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Varrer';
  }
}

function updateScanMode() {
  const isFollowers = $('scan-mode').value === 'followers';
  $('scan-posts-group').classList.toggle('hidden', isFollowers);
  $('scan-session-group').classList.toggle('hidden', !isFollowers);
  $('scan-session-panel').classList.toggle('hidden', !isFollowers);
}

$('tab-auto').addEventListener('click', () => switchTab('auto'));
$('tab-manual').addEventListener('click', () => switchTab('manual'));
$('tab-scan').addEventListener('click', () => switchTab('scan'));
$('btn-scan').addEventListener('click', scanProfile);
$('scan-mode').addEventListener('change', updateScanMode);
$('btn-analyze').addEventListener('click', analyzeAuto);
$('btn-analyze-manual').addEventListener('click', analyzeManual);
$('btn-demo').addEventListener('click', loadDemo);
$('btn-save').addEventListener('click', saveLeads);
$('btn-clear').addEventListener('click', clearSaved);
$('post-url').addEventListener('keydown', e => e.key === 'Enter' && analyzeAuto());
document.querySelectorAll('.filter').forEach(btn =>
  btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter;
    document.querySelectorAll('.filter').forEach(b => b.classList.toggle('active', b === btn));
    applyFilter();
  })
);

loadSaved();
