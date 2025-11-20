// app.js integrado com a API .NET backendAPI
// Ajuste os IDs de elementos HTML conforme o seu layout.

// =========================
// CONFIG E HELPERS DE API
// =========================
const API_BASE = 'http://localhost:5166';

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  if (token) localStorage.setItem('token', token);
}

function clearToken() {
  localStorage.removeItem('token');
}

function authHeaders(json = true) {
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';

  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return headers;
}

const API = {
  // Login na API nova: POST /api/Auth/login  { email, password }
  async login(email, senha) {
    try {
      const r = await fetch(`${API_BASE}/api/Auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: senha })
      });

      const data = await r.json().catch(() => ({}));
      const ok = (typeof data.success === 'boolean') ? data.success : r.ok;

      return {
        ok,
        user: data.user || data.data || null,
        token: data.token || null,
        message: data.message || null,
        error: ok ? null : (data.message || 'Falha no login')
      };
    } catch (e) {
      console.error('Erro login', e);
      return { ok: false, error: e.message };
    }
  },

  async get(path) {
    try {
      const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
      const r = await fetch(url, {
        method: 'GET',
        headers: authHeaders(false)
      });
      const data = await r.json().catch(() => ({}));

      if (typeof data.success === 'boolean' && 'data' in data) {
        return {
          ok: data.success,
          data: data.data,
          message: data.message,
          error: data.success ? null : (data.message || 'Erro na API'),
          raw: data
        };
      }

      return {
        ok: r.ok,
        data,
        message: data && data.message,
        error: r.ok ? null : ((data && data.message) || 'Erro na API'),
        raw: data
      };
    } catch (e) {
      console.error('Erro GET', e);
      return { ok: false, error: e.message };
    }
  },

  async post(path, body) {
    try {
      const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(body)
      });
      const data = await r.json().catch(() => ({}));

      if (typeof data.success === 'boolean' && 'data' in data) {
        return {
          ok: data.success,
          data: data.data,
          message: data.message,
          error: data.success ? null : (data.message || 'Erro na API'),
          raw: data
        };
      }

      return {
        ok: r.ok,
        data,
        message: data && data.message,
        error: r.ok ? null : ((data && data.message) || 'Erro na API'),
        raw: data
      };
    } catch (e) {
      console.error('Erro POST', e);
      return { ok: false, error: e.message };
    }
  },

  // Usaremos PUT pro update de status / severity
  async put(path, body) {
    try {
      const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
      const r = await fetch(url, {
        method: 'PUT',
        headers: authHeaders(true),
        body: body ? JSON.stringify(body) : null
      });
      const data = await r.json().catch(() => ({}));

      if (typeof data.success === 'boolean' && 'data' in data) {
        return {
          ok: data.success,
          data: data.data,
          message: data.message,
          error: data.success ? null : (data.message || 'Erro na API'),
          raw: data
        };
      }

      return {
        ok: r.ok,
        data,
        message: data && data.message,
        error: r.ok ? null : ((data && data.message) || 'Erro na API'),
        raw: data
      };
    } catch (e) {
      console.error('Erro PUT', e);
      return { ok: false, error: e.message };
    }
  }
};

// =========================
// ESTADO GLOBAL SIMPLES
// =========================
const state = {
  user: null,       // objeto retornado pelo login (id, name, role, etc)
  role: null,       // 'user' | 'tech' | 'admin'
  currentTicketId: null,
  currentTicket: null,
  messagesTimer: null
};

// =========================
// UI HELPERS
// =========================
function showSection(id) {
  const sections = document.querySelectorAll('.page-section');
  sections.forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function showToast(msg, type = 'info') {
  console.log(`[${type}]`, msg);
  const box = document.getElementById('toast');
  if (!box) return;
  box.textContent = msg;
  box.className = '';
  box.classList.add('toast', `toast-${type}`);
  box.classList.add('show');
  setTimeout(() => box.classList.remove('show'), 3000);
}

// =========================
// LOGIN / LOGOUT
// =========================
async function handleLogin(e) {
  e.preventDefault();

  const emailInput = document.getElementById('email');
  const passInput = document.getElementById('senha');  // <- ID correto

  const email = emailInput.value.trim();
  const password = passInput.value.trim();  // <- API espera "password"

  if (!email || !password) {
    showToast('Informe e-mail e senha', 'error');
    return;
  }

  const res = await API.login(email, password);

  if (!res.ok || !res.user || !res.token) {
    showToast(res.error || 'Login inválido', 'error');
    return;
  }

  setToken(res.token);
  state.user = res.user;


  // Ajuste aqui de acordo com a propriedade de papel que vier do backend
  // Por exemplo: user.role, user.tipo, user.perfil...
  const role = (res.user.role || res.user.perfil || '').toLowerCase();
  state.role = role;

  showToast('Login realizado com sucesso', 'success');
  initAfterLogin();
}

function handleLogout() {
  clearToken();
  state.user = null;
  state.role = null;
  state.currentTicketId = null;
  clearInterval(state.messagesTimer);
  state.messagesTimer = null;
  showSection('login-section');
}

// =========================
// PÓS LOGIN: ROTEAMENTO
// =========================
function initAfterLogin() {
  if (!state.user) return;

  // Atualiza nome na UI
  const spanUser = document.getElementById('current-user-name');
  if (spanUser) spanUser.textContent = state.user.name || state.user.nome || state.user.email || 'Usuário';

  if (state.role === 'tech' || state.role === 'tecnico') {
    showSection('tech-section');
    loadTechTickets();
  } else if (state.role === 'admin') {
    showSection('admin-section');
    loadAdminDashboard();
  } else {
    // padrão: usuário
    state.role = 'user';
    showSection('user-section');
    loadUserTickets();
  }
}

// =========================
// USUÁRIO COMUM - TICKETS
// =========================
async function loadUserTickets() {
  if (!state.user) return;

  // GET /api/Tickets/user/{userId}
  const res = await API.get(`/api/Tickets/user/${state.user.id || state.user.userId || state.user.idUser || ''}`);
  if (!res.ok) {
    showToast(res.error || 'Erro ao carregar chamados', 'error');
    return;
  }

  let tickets = res.data || [];
  tickets = tickets.map(t => ({
    ...t,
    id: t.id || t.ticketId || t.Id,
    status: (t.status || t.Status || '').toLowerCase(),
    gravidade: t.gravidade || t.severity || t.Severity,
    descricao: t.descricao || t.description || t.Description,
    dataCriacao: t.dataCriacao || t.createdAt || t.CreatedAt
  }));

  renderUserTickets(tickets);
}

function renderUserTickets(tickets) {
  const list = document.getElementById('user-tickets');
  if (!list) return;

  list.innerHTML = '';
  if (!tickets.length) {
    list.innerHTML = '<p>Nenhum chamado encontrado.</p>';
    return;
  }

  tickets.forEach(t => {
    const div = document.createElement('div');
    div.className = 'ticket-card';
    div.innerHTML = `
      <div class="ticket-header">
        <span class="ticket-id">#${t.id}</span>
        <span class="ticket-status status-${t.status}">${t.status}</span>
      </div>
      <div class="ticket-body">
        <div><strong>Assunto:</strong> ${t.title || t.titulo || 'Chamado'}</div>
        <div><strong>Descrição:</strong> ${t.descricao || ''}</div>
        <div><strong>Gravidade:</strong> ${t.gravidade || '-'}</div>
      </div>
      <div class="ticket-footer">
        <button class="btn btn-xs btn-chat" data-id="${t.id}">Abrir chat</button>
      </div>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll('.btn-chat').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openChatForTicket(id);
    });
  });
}

// =========================
// TÉCNICO - TICKETS
// =========================
async function loadTechTickets() {
  // GET /api/Tickets
  const res = await API.get('/api/Tickets');
  if (!res.ok) {
    showToast(res.error || 'Erro ao carregar chamados', 'error');
    return;
  }

  let tickets = res.data || [];
  tickets = tickets.map(t => ({
    ...t,
    id: t.id || t.ticketId || t.Id,
    status: (t.status || t.Status || '').toLowerCase(),
    gravidade: t.gravidade || t.severity || t.Severity,
    descricao: t.descricao || t.description || t.Description,
    dataCriacao: t.dataCriacao || t.createdAt || t.CreatedAt,
    nomeUsuario: t.userName || t.user?.name || t.user?.nome || t.NomeUsuario
  }));

  renderTechTickets(tickets);
}

function renderTechTickets(tickets) {
  const tbody = document.getElementById('tech-tickets');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!tickets.length) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhum chamado encontrado.</td></tr>';
    return;
  }

  tickets.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${t.id}</td>
      <td>${t.nomeUsuario || '-'}</td>
      <td>${t.descricao || '-'}</td>
      <td>${t.gravidade || '-'}</td>
      <td>
        <button class="btn btn-xs btn-chat" data-id="${t.id}">Chat</button>
        <button class="btn btn-xs btn-close" data-id="${t.id}">Fechar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-chat').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openChatForTicket(id);
    });
  });

  tbody.querySelectorAll('.btn-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      closeTicket(id);
    });
  });
}

async function closeTicket(ticketId) {
  if (!confirm(`Deseja realmente fechar o chamado #${ticketId}?`)) return;

  // PUT /api/Tickets/{id}/status  { status: 'fechado' }
  const res = await API.put(`/api/Tickets/${ticketId}/status`, { status: 'fechado' });
  if (!res.ok) {
    showToast(res.error || 'Erro ao fechar chamado', 'error');
    return;
  }
  showToast('Chamado fechado com sucesso', 'success');
  loadTechTickets();
  loadAdminDashboard(); // atualiza métricas se admin estiver logado
}

// =========================
// CHAT DE MENSAGENS
// =========================
async function openChatForTicket(ticketId) {
  state.currentTicketId = ticketId;

  const modal = document.getElementById('chat-modal');
  if (modal) modal.classList.add('open');

  await loadMessages(ticketId);

  if (state.messagesTimer) clearInterval(state.messagesTimer);
  state.messagesTimer = setInterval(() => {
    if (state.currentTicketId) loadMessages(state.currentTicketId, true);
  }, 5000);
}

// GET /api/Messages/ticket/{ticketId}
async function loadMessages(ticketId, silent = false) {
  const res = await API.get(`/api/Messages/ticket/${ticketId}`);
  if (!res.ok) {
    if (!silent) showToast(res.error || 'Erro ao carregar mensagens', 'error');
    return;
  }

  let msgs = res.data || [];
  msgs = msgs.map(m => ({
    ...m,
    id: m.id || m.messageId || m.Id,
    senderRole: (m.senderRole || m.sender_role || '').toLowerCase(),
    senderName: m.senderName || m.sender_name || '',
    content: m.content || m.text || '',
    sentAt: m.sentAt || m.dataEnvio || m.createdAt
  }));

  renderMessages(msgs);
}

function renderMessages(msgs) {
  const box = document.getElementById('chat-messages');
  if (!box) return;

  box.innerHTML = '';
  if (!msgs.length) {
    box.innerHTML = '<p>Sem mensagens ainda.</p>';
    return;
  }

  msgs.forEach(m => {
    const div = document.createElement('div');
    const isUser = m.senderRole === 'user';
    const isTech = m.senderRole === 'tech' || m.senderRole === 'tecnico';
    const isAdmin = m.senderRole === 'admin';

    let cls = 'msg';
    if (isUser) cls += ' msg-user';
    else if (isTech) cls += ' msg-tech';
    else if (isAdmin) cls += ' msg-admin';

    div.className = cls;
    div.innerHTML = `
      <div class="msg-meta">
        <span class="msg-sender">${m.senderName || m.senderRole}</span>
        <span class="msg-time">${m.sentAt || ''}</span>
      </div>
      <div class="msg-text">${m.content}</div>
    `;
    box.appendChild(div);
  });

  box.scrollTop = box.scrollHeight;
}

async function sendMessage() {
  if (!state.currentTicketId || !state.user) return;

  const input = document.getElementById('chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const role = state.role || 'user';

  const body = {
    ticketId: Number(state.currentTicketId),
    senderId: state.user.id || state.user.userId || state.user.idUser,
    senderRole: role,
    content: text
  };

  // POST /api/Messages
  const res = await API.post('/api/Messages', body);
  if (!res.ok) {
    showToast(res.error || 'Erro ao enviar mensagem', 'error');
    return;
  }

  input.value = '';
  await loadMessages(state.currentTicketId, true);
}

// =========================
// ADMIN - DASHBOARD
// =========================
async function loadAdminDashboard() {
  // Sem endpoint /api/metrics, calculamos com /api/Tickets
  const res = await API.get('/api/Tickets');
  if (!res.ok) {
    showToast(res.error || 'Erro ao carregar métricas', 'error');
    return;
  }

  const tickets = (res.data || []).map(t => ({
    ...t,
    status: (t.status || t.Status || '').toLowerCase(),
    gravidade: t.gravidade || t.severity || t.Severity,
    userName: t.userName || t.user?.name || t.user?.nome
  }));

  const total = tickets.length;
  const concluidos = tickets.filter(t => t.status === 'fechado' || t.status === 'concluido').length;
  const abertos = total - concluidos;

  const elTotal = document.getElementById('metric-total');
  const elAbertos = document.getElementById('metric-open');
  const elFechados = document.getElementById('metric-closed');

  if (elTotal) elTotal.textContent = total;
  if (elAbertos) elAbertos.textContent = abertos;
  if (elFechados) elFechados.textContent = concluidos;

  renderAdminTicketsTable(tickets);
}

function renderAdminTicketsTable(tickets) {
  const tbody = document.getElementById('admin-tickets');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!tickets.length) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhum chamado encontrado.</td></tr>';
    return;
  }

  tickets.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${t.id}</td>
      <td>${t.userName || '-'}</td>
      <td>${t.descricao || t.description || '-'}</td>
      <td>${t.gravidade || '-'}</td>
      <td>${t.status || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// =========================
// EVENTOS INICIAIS
// =========================
document.addEventListener('DOMContentLoaded', () => {
  // Form de login
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Botão logout
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Botão enviar mensagem
  const sendBtn = document.getElementById('chat-send');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }

  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keyup', e => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  // Botão fechar modal de chat
  const chatClose = document.getElementById('chat-close');
  if (chatClose) {
    chatClose.addEventListener('click', () => {
      const modal = document.getElementById('chat-modal');
      if (modal) modal.classList.remove('open');
      state.currentTicketId = null;
      if (state.messagesTimer) clearInterval(state.messagesTimer);
      state.messagesTimer = null;
    });
  }

  // Se já tiver token salvo, tenta recuperar usuário via storage (você pode depois trocar por /me)
  const token = getToken();
  if (!token) {
    showSection('login-section');
  } else {
    // Como não temos endpoint /me, só voltamos pro login.
    // Se quiser, crie /api/Auth/me e chame aqui para restaurar sessão.
    clearToken();
    showSection('login-section');
  }
});

console.log('app.js carregado e integrado com a API .NET em', API_BASE);
