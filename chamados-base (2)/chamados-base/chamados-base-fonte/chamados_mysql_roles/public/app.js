// Frontend JS para o sistema de chamados (somente front)
// Mantém o consumo dos endpoints da API .NET sem modificar a API

const API_BASE = 'http://localhost:5166';

// =========================================================
// Helpers de sessão/autenticação
// =========================================================
const STORAGE_KEYS = {
  token: 'token',
  user: 'sessionUser'
};

const state = {
  user: null,
  role: null,
  currentTicketId: null,
  messageTimer: null
};

function normalizeRole(role) {
  return (role || '').toString().trim().toLowerCase();
}

function getToken() {
  return localStorage.getItem(STORAGE_KEYS.token);
}

function setToken(token) {
  if (token) {
    localStorage.setItem(STORAGE_KEYS.token, token);
  }
}

function clearToken() {
  localStorage.removeItem(STORAGE_KEYS.token);
}

function saveUserSession(user) {
  if (user) {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  }
}

function loadUserSession() {
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession() {
  clearToken();
  localStorage.removeItem(STORAGE_KEYS.user);
}

function authHeaders(withJson = true) {
  const headers = {};
  if (withJson) headers['Content-Type'] = 'application/json';

  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return headers;
}

// =========================================================
// Feedback visual
// =========================================================
function showAlert(text, type = 'info') {
  if (window.Swal) {
    Swal.fire({
      toast: true,
      position: 'top-end',
      timer: 3000,
      showConfirmButton: false,
      icon: type,
      title: text
    });
  } else {
    console.log(`[${type}] ${text}`);
  }

  const who = document.getElementById('who');
  if (who && state.user) {
    const name = state.user.name || state.user.nome || state.user.email;
    who.textContent = `${name} • ${state.role || ''}`;
  }
}

function teardownChatPolling() {
  if (state.messageTimer) {
    clearInterval(state.messageTimer);
    state.messageTimer = null;
  }
}

// =========================================================
// Cliente de API
// =========================================================
async function parseApiResponse(response) {
  const json = await response.json().catch(() => null);
  const ok = json?.success ?? response.ok;
  return {
    ok,
    data: json?.data ?? json,
    message: json?.message,
    errors: json?.errors,
    raw: json
  };
}

const API = {
  async login(email, password) {
    try {
      const response = await fetch(`${API_BASE}/api/Auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const json = await response.json();
      const ok = json && json.success === true;

      return {
        ok,
        user: json.user || null,
        token: json.token || null,
        message: json.message || null,
        error: ok ? null : (json.message || 'Falha no login')
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  async get(path) {
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    try {
      const response = await fetch(url, { headers: authHeaders(false) });
      const parsed = await parseApiResponse(response);
      return {
        ok: parsed.ok,
        data: parsed.data,
        message: parsed.message,
        error: parsed.ok ? null : (parsed.message || 'Erro ao consultar API')
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  async post(path, body) {
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(body)
      });
      const parsed = await parseApiResponse(response);
      return {
        ok: parsed.ok,
        data: parsed.data,
        message: parsed.message,
        error: parsed.ok ? null : (parsed.message || 'Erro ao enviar dados')
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  async put(path, body) {
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: authHeaders(true),
        body: body ? JSON.stringify(body) : null
      });
      const parsed = await parseApiResponse(response);
      return {
        ok: parsed.ok,
        data: parsed.data,
        message: parsed.message,
        error: parsed.ok ? null : (parsed.message || 'Erro ao atualizar')
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
};

// =========================================================
// Navegação
// =========================================================
const ROUTES = {
  login: 'login',
  userHub: 'user-hub',
  userNew: 'user-new',
  userChat: 'user-chat',
  techHome: 'tech-home',
  techChat: 'tech-chat',
  admin: 'admin-metrics'
};

function setRoute(route) {
  document.querySelectorAll('section[data-route]').forEach(section => {
    section.classList.add('hidden');
  });
  const target = document.querySelector(`section[data-route="${route}"]`);
  if (target) target.classList.remove('hidden');
}

function applyUserInfo() {
  const who = document.getElementById('who');
  if (who && state.user) {
    const name = state.user.name || state.user.nome || state.user.email;
    who.textContent = `${name} • ${state.role || 'user'}`;
  }
}

function updateUIAfterLogin() {
  if (!state.user) return;
  applyUserInfo();

  if (state.role === 'admin') {
    setRoute(ROUTES.admin);
    loadAdminMetrics();
  } else if (state.role === 'tech' || state.role === 'tecnico') {
    setRoute(ROUTES.techHome);
    loadTechTickets();
  } else {
    state.role = 'user';
    setRoute(ROUTES.userHub);
    loadUserTickets();
  }
}

function handleLogout() {
  clearSession();
  state.user = null;
  state.role = null;
  state.currentTicketId = null;
  teardownChatPolling();
  setRoute(ROUTES.login);
  const who = document.getElementById('who');
  if (who) who.textContent = '';
}

// =========================================================
// Login
// =========================================================
async function handleLogin(event) {
  event.preventDefault();

  const email = (document.getElementById('email')?.value || '').trim();
  const password = (document.getElementById('senha')?.value || '').trim();

  if (!email || !password) {
    showAlert('Informe e-mail e senha', 'error');
    return;
  }

  const result = await API.login(email, password);

  if (!result.ok || !result.user || !result.token) {
    showAlert(result.error || 'Login inválido', 'error');
    return;
  }

  setToken(result.token);
  state.user = result.user;
  state.role = (result.user.role || '').toLowerCase();
  saveUserSession(state.user);

  showAlert(result.message || 'Login realizado', 'success');
  updateUIAfterLogin();
}

// =========================================================
// Tickets - helpers
// =========================================================
function mapTicket(raw) {
  return {
    id: raw.id ?? raw.Id,
    userId: raw.userId ?? raw.UserId,
    userName: raw.userName ?? raw.UserName,
    severity: raw.severity ?? raw.Severity,
    description: raw.description ?? raw.Description,
    status: (raw.status ?? raw.Status ?? '').toLowerCase(),
    createdAt: raw.createdAt ?? raw.CreatedAt ?? ''
  };
}

function statusIsClosed(status) {
  return ['fechado', 'concluido', 'finalizado'].includes(
    (status || '').toLowerCase()
  );
}

// técnico só vê chamados que realmente foram encaminhados pra ele
function isTechOpenStatus(status) {
  const s = (status || '').toLowerCase();
  return s === 'em_andamento' || s === 'em_atendimento';
}

// =========================================================
// Usuário comum
// =========================================================
async function loadUserTickets() {
  if (!state.user) return;
  const tbody = document.getElementById('user-hub-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5">Carregando…</td></tr>';

  const userId = state.user.id || state.user.Id || state.user.userId;
  const res = await API.get(`/api/Tickets/user/${userId}`);
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="5">${res.error || 'Erro ao carregar chamados'}</td></tr>`;
    return;
  }

  const tickets = (res.data || []).map(mapTicket);
  renderUserTickets(tickets);
}

function renderUserTickets(tickets) {
  const tbody = document.getElementById('user-hub-tbody');
  if (!tbody) return;

  const activeTab =
    document.querySelector('.user-tab.active')?.dataset.tab || 'abertos';
  const filtered = tickets.filter(t =>
    activeTab === 'abertos' ? !statusIsClosed(t.status) : statusIsClosed(t.status)
  );

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhum chamado encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach(ticket => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${ticket.id}</td>
      <td>${ticket.severity || '-'}</td>
      <td>${ticket.description || '-'}</td>
      <td>${ticket.status || '-'}</td>
      <td><button class="btn" data-ticket="${ticket.id}">Chat</button></td>
    `;
    tr
      .querySelector('button')
      ?.addEventListener('click', () => openUserChat(ticket));
    tbody.appendChild(tr);
  });
}

async function handleCreateTicket(event) {
  event.preventDefault();
  if (!state.user) return;

  const nome = (document.getElementById('nome')?.value || '').trim();
  const gravidade = (document.getElementById('gravidade')?.value || '').trim();
  const descricao = (document.getElementById('descricao')?.value || '').trim();

  if (!gravidade || !descricao) {
    showAlert('Preencha gravidade e descrição', 'error');
    return;
  }

  const body = {
    userId: state.user.id || state.user.Id,
    userName: nome || state.user.name || state.user.nome || state.user.email,
    severity: gravidade,
    description: descricao
  };

  const res = await API.post('/api/Tickets', body);
  if (!res.ok) {
    showAlert(res.error || 'Erro ao abrir chamado', 'error');
    return;
  }

  showAlert('Chamado aberto com sucesso', 'success');
  setRoute(ROUTES.userHub);
  loadUserTickets();
  event.target.reset();
}

function openNewTicketForm() {
  setRoute(ROUTES.userNew);
}

function backToUserHub() {
  setRoute(ROUTES.userHub);
  loadUserTickets();
}

// =========================================================
// Chat do usuário
// =========================================================
function openUserChat(ticket) {
  state.currentTicketId = ticket.id;
  const header = document.getElementById('user-chat-header');
  if (header)
    header.textContent = `Chamado #${ticket.id} • ${
      ticket.description || ''
    }`;
  setRoute(ROUTES.userChat);
  loadMessagesForRole('user');
  teardownChatPolling();
  state.messageTimer = setInterval(
    () => loadMessagesForRole('user', true),
    4000
  );
}

async function loadMessagesForRole(role, silent = false) {
  if (!state.currentTicketId) return;
  const res = await API.get(`/api/Messages/ticket/${state.currentTicketId}`);
  if (!res.ok) {
    if (!silent) showAlert(res.error || 'Erro ao carregar mensagens', 'error');
    return;
  }

  const msgs = (res.data || []).map(msg => ({
    id: msg.id ?? msg.Id,
    senderRole: normalizeRole(msg.senderRole || msg.SenderRole),
    senderName: msg.senderName || msg.SenderName,
    content: msg.content || msg.Content,
    createdAt: msg.createdAt || msg.CreatedAt
  }));

  renderMessages(msgs, role);
}

function renderMessages(messages, role) {
  const target =
    role === 'tech'
      ? document.getElementById('tech-chatbox')
      : document.getElementById('user-chatbox');
  if (!target) return;

  target.innerHTML = '';
  if (!messages.length) {
    target.innerHTML = '<p class="note">Sem mensagens ainda.</p>';
    return;
  }

  messages.forEach(msg => {
    const div = document.createElement('div');
    div.className = `msg msg-${msg.senderRole || 'user'}`;
    div.innerHTML = `
      <div class="msg-meta">${msg.senderName || msg.senderRole} • ${
      msg.createdAt || ''
    }</div>
      <div class="msg-text">${msg.content || ''}</div>
    `;
    target.appendChild(div);
  });

  target.scrollTop = target.scrollHeight;
}

async function sendUserMessage() {
  if (!state.user || !state.currentTicketId) return;
  const input = document.getElementById('user-msg');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const body = {
    ticketId: Number(state.currentTicketId),
    senderId: state.user.id || state.user.Id,
    senderRole: state.role || 'user',
    content: text
  };

  const res = await API.post('/api/Messages', body);
  if (!res.ok) {
    showAlert(res.error || 'Erro ao enviar mensagem', 'error');
    return;
  }

  input.value = '';
  loadMessagesForRole('user', true);
}

async function markTicketComplete() {
  if (!state.currentTicketId) return;
  const res = await API.put(
    `/api/Tickets/${state.currentTicketId}/status`,
    { status: 'fechado' }
  );
  if (!res.ok) {
    showAlert(res.error || 'Erro ao fechar chamado', 'error');
    return;
  }

  showAlert('Chamado marcado como concluído', 'success');

  // se for técnico, volta pra lista do técnico
  if (state.role === 'tech' || state.role === 'tecnico') {
    setRoute(ROUTES.techHome);
    loadTechTickets();
  } else {
    setRoute(ROUTES.userHub);
    loadUserTickets();
  }
}

async function requestTechSupport() {
  if (!state.currentTicketId) return;
  const res = await API.put(
    `/api/Tickets/${state.currentTicketId}/status`,
    { status: 'em_andamento' }
  );
  if (!res.ok) {
    showAlert(res.error || 'Não foi possível chamar o técnico', 'error');
    return;
  }

  showAlert('Técnico acionado para o chamado', 'info');
}

// =========================================================
// Técnico
// =========================================================
async function loadTechTickets() {
  const tbody = document.getElementById('tech-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5">Carregando…</td></tr>';

  const res = await API.get('/api/Tickets');
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="5">${
      res.error || 'Erro ao carregar chamados'
    }</td></tr>`;
    return;
  }

  const tickets = (res.data || []).map(mapTicket);
  renderTechTickets(tickets);
}

function renderTechTickets(tickets) {
  const tbody = document.getElementById('tech-tbody');
  if (!tbody) return;

  const activeTab = document.querySelector('.tab.active')?.dataset.tab || 'abertos';

  let filtered;
  if (activeTab === 'abertos') {
    filtered = tickets.filter(t => isTechOpenStatus(t.status));
  } else {
    filtered = tickets.filter(t => statusIsClosed(t.status));
  }

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhum chamado encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach(ticket => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${ticket.id}</td>
      <td>${ticket.userName || '-'}</td>
      <td>${ticket.severity || '-'}</td>
      <td>${ticket.description || '-'}</td>
      <td><button class="btn" data-ticket="${ticket.id}">Chat</button></td>
    `;
    tr
      .querySelector('button')
      ?.addEventListener('click', () => openTechChat(ticket));
    tbody.appendChild(tr);
  });
}

function openTechChat(ticket) {
  state.currentTicketId = ticket.id;
  const header = document.getElementById('tech-ticket-head');
  if (header)
    header.textContent = `Chamado #${ticket.id} • ${ticket.userName || ''}`;
  setRoute(ROUTES.techChat);
  loadMessagesForRole('tech');
  teardownChatPolling();
  state.messageTimer = setInterval(
    () => loadMessagesForRole('tech', true),
    4000
  );
}

async function sendTechMessage() {
  if (!state.user || !state.currentTicketId) return;
  const input = document.getElementById('tech-msg');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const body = {
    ticketId: Number(state.currentTicketId),
    senderId: state.user.id || state.user.Id,
    senderRole: state.role || 'tech',
    content: text
  };

  const res = await API.post('/api/Messages', body);
  if (!res.ok) {
    showAlert(res.error || 'Erro ao enviar mensagem', 'error');
    return;
  }

  input.value = '';
  loadMessagesForRole('tech', true);
}

// =========================================================
// Admin - métricas
// =========================================================
let chartsCreated = false;
let ticketsChartInstance = null;
let gravidadesChartInstance = null;
let statusChartInstance = null;

async function loadAdminMetrics() {
  const [totalRes, openRes, closedRes, statsGrav, statsStatus, topUsers] =
    await Promise.all([
      API.get('/api/Tickets/count'),
      API.get('/api/Tickets/count/abertos'),
      API.get('/api/Tickets/count/concluidos'),
      API.get('/api/Tickets/stats/gravidade'),
      API.get('/api/Tickets/stats/status'),
      API.get('/api/Tickets/stats/top-usuarios')
    ]);

  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? 0;
  };

  setValue('totalTickets', totalRes.ok ? totalRes.data : 0);
  setValue('openTickets', openRes.ok ? openRes.data : 0);
  setValue('closedTickets', closedRes.ok ? closedRes.data : 0);

  const ticketsRes = await API.get('/api/Tickets');
  if (!ticketsRes.ok) {
    showAlert(ticketsRes.error || 'Erro ao carregar métricas', 'error');
    return;
  }

  const tickets = (ticketsRes.data || []).map(mapTicket);
  renderCharts({
    tickets,
    bySeverity: statsGrav.ok ? statsGrav.data : {},
    byStatus: statsStatus.ok ? statsStatus.data : {},
    byUser: topUsers.ok ? topUsers.data : {}
  });
}

function renderCharts({ tickets, bySeverity, byStatus, byUser }) {
  const ctxTickets = document.getElementById('ticketsChart');
  const ctxGravidades = document.getElementById('gravidadesChart');
  const ctxStatus = document.getElementById('statusChart');

  if (!Object.keys(byUser).length) {
    tickets.forEach(t => {
      byUser[t.userName] = (byUser[t.userName] || 0) + 1;
    });
  }
  if (!Object.keys(bySeverity).length) {
    tickets.forEach(t => {
      bySeverity[t.severity] = (bySeverity[t.severity] || 0) + 1;
    });
  }
  if (!Object.keys(byStatus).length) {
    tickets.forEach(t => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    });
  }

  if (!chartsCreated) {
    chartsCreated = true;
    ticketsChartInstance = new Chart(ctxTickets, {
      type: 'bar',
      data: {
        labels: Object.keys(byUser),
        datasets: [
          { label: 'Chamados por usuário', data: Object.values(byUser) }
        ]
      },
      options: { responsive: true }
    });

    gravidadesChartInstance = new Chart(ctxGravidades, {
      type: 'pie',
      data: {
        labels: Object.keys(bySeverity),
        datasets: [{ data: Object.values(bySeverity) }]
      },
      options: { responsive: true }
    });

    statusChartInstance = new Chart(ctxStatus, {
      type: 'doughnut',
      data: {
        labels: Object.keys(byStatus),
        datasets: [{ data: Object.values(byStatus) }]
      },
      options: { responsive: true }
    });
  } else {
    ticketsChartInstance.data.labels = Object.keys(byUser);
    ticketsChartInstance.data.datasets[0].data = Object.values(byUser);
    ticketsChartInstance.update();

    gravidadesChartInstance.data.labels = Object.keys(bySeverity);
    gravidadesChartInstance.data.datasets[0].data =
      Object.values(bySeverity);
    gravidadesChartInstance.update();

    statusChartInstance.data.labels = Object.keys(byStatus);
    statusChartInstance.data.datasets[0].data =
      Object.values(byStatus);
    statusChartInstance.update();
  }
}

// =========================================================
// Event binding
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const logoutButton = document.getElementById('logout-btn');
  if (logoutButton) logoutButton.addEventListener('click', handleLogout);

  const newTicketBtn = document.getElementById('user-hub-new');
  if (newTicketBtn) newTicketBtn.addEventListener('click', openNewTicketForm);

  const backFromNew = document.getElementById('user-new-back');
  if (backFromNew) backFromNew.addEventListener('click', backToUserHub);

  const ticketForm = document.getElementById('ticket-form');
  if (ticketForm) ticketForm.addEventListener('submit', handleCreateTicket);

  const userTabs = document.querySelectorAll('.user-tab');
  userTabs.forEach(tab =>
    tab.addEventListener('click', () => {
      userTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadUserTickets();
    })
  );

  const techTabs = document.querySelectorAll('.tab');
  techTabs.forEach(tab =>
    tab.addEventListener('click', () => {
      techTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadTechTickets();
    })
  );

  document
    .getElementById('user-send')
    ?.addEventListener('click', sendUserMessage);
  document
    .getElementById('user-msg')
    ?.addEventListener('keyup', e => {
      if (e.key === 'Enter') sendUserMessage();
    });
  document
    .getElementById('user-complete')
    ?.addEventListener('click', markTicketComplete);
  document
    .getElementById('btnChamarTecnico')
    ?.addEventListener('click', requestTechSupport);
  document
    .getElementById('user-chat-back')
    ?.addEventListener('click', () => {
      teardownChatPolling();
      setRoute(ROUTES.userHub);
      loadUserTickets();
    });

  document
    .getElementById('tech-send')
    ?.addEventListener('click', sendTechMessage);
  document
    .getElementById('tech-msg')
    ?.addEventListener('keyup', e => {
      if (e.key === 'Enter') sendTechMessage();
    });
  document
    .getElementById('tech-back')
    ?.addEventListener('click', () => {
      teardownChatPolling();
      setRoute(ROUTES.techHome);
      loadTechTickets();
    });
  document
    .getElementById('tech-complete')
    ?.addEventListener('click', markTicketComplete);

  const existingUser = loadUserSession();
  if (existingUser) {
    state.user = existingUser;
    state.role = normalizeRole(existingUser.role || existingUser.Role);
    applyUserInfo();
    updateUIAfterLogin();
  } else {
    setRoute(ROUTES.login);
    clearSession();
  }
});

console.log('Frontend pronto e apontando para', API_BASE);
