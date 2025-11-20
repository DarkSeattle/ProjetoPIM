// ==========================
// SISTEMA DE CHAMADOS — BACKEND (Node.js / Express / MSSQL)
// index.js completo — ES Modules
// ==========================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, sql } from './db.js';
import { perguntarIA } from './ia.js';

// ==========================
// CONSTANTES GLOBAIS
// ==========================
const IA_USER_ID = 4; // ID fixo da IA

// ==========================
// __dirname compatível com ES Modules
// ==========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================
// CONFIGURAÇÕES DO EXPRESS
// ==========================
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ==========================
// FUNÇÕES AUXILIARES
// ==========================
function getAuth(req) {
  const id = Number(req.headers['x-user-id'] || 0);
  const role = (req.headers['x-user-role'] || '').toLowerCase();
  return { id, role };
}

function requireRole(...roles) {
  return (req, res, next) => {
    const { role } = getAuth(req);
    if (!roles.includes(role)) return res.status(403).json({ ok: false, error: 'Acesso negado' });
    next();
  };
}

// ==========================
// LOGIN
// ==========================
app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body ?? {};
  if (!email || !senha) return res.status(400).json({ ok: false, error: 'Informe email e senha' });

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .input('senha', sql.NVarChar, senha)
      .query('SELECT id, nome, role FROM dbo.users WHERE email=@email AND senha=@senha');

    if (!result.recordset.length) return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
    res.json({ ok: true, user: result.recordset[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erro interno no servidor' });
  }
});

// ==========================
// CRIAR CHAMADO (USUÁRIO)
// ==========================
app.post('/api/tickets', requireRole('user'), async (req, res) => {
  const { id: userId } = getAuth(req);
  const { nome, gravidade, descricao } = req.body ?? {};

  if (!nome || !gravidade || !descricao)
    return res.status(400).json({ ok: false, error: 'Campos obrigatórios ausentes' });

  try {
    const pool = await connectDB();
    const insertResult = await pool.request()
      .input('userId', sql.Int, userId)
      .input('nome_usuario', sql.NVarChar, nome)
      .input('gravidade', sql.NVarChar, gravidade)
      .input('descricao', sql.NVarChar, descricao)
      .input('status', sql.NVarChar, 'aberto')
      .query(`
        INSERT INTO dbo.tickets (user_id, nome_usuario, gravidade, descricao, status, ajuda_presencial, created_at)
        VALUES (@userId, @nome_usuario, @gravidade, @descricao, @status, 0, GETDATE());
        SELECT SCOPE_IDENTITY() AS id;
      `);

    const ticketId = insertResult.recordset[0].id;
    const ticket = await pool.request()
      .input('id', sql.Int, ticketId)
      .query('SELECT * FROM dbo.tickets WHERE id=@id');

    res.json({ ok: true, data: ticket.recordset[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erro ao criar chamado', detalhes: err.message });
  }
});

// ==========================
// API TICKETS — sem filtro por técnico
// ==========================
app.get('/api/tickets', requireRole('user', 'tech', 'admin'), async (req, res) => {
  try {
    const pool = await connectDB();
    const { status } = req.query;

    let whereClause = '';
    
    if (status === 'concluido') {
      whereClause = "WHERE status = 'concluido'";
    } else if (status === 'aguardando_tecnico') {
      whereClause = "WHERE status = 'aguardando_tecnico'";
    } else {
      // Se não especificar, mostra apenas aguardando_tecnico (padrão para técnicos)
      whereClause = "WHERE status = 'aguardando_tecnico'";
    }

    const result = await pool.request()
      .query(`SELECT * FROM tickets ${whereClause} ORDER BY id DESC`);

    res.json({ ok: true, data: result.recordset });
  } catch (err) {
    console.error('Erro ao listar tickets:', err);
    res.status(500).json({ ok: false, error: 'Erro ao listar tickets' });
  }
});

// ==========================
// LISTAR CHAMADOS (USUÁRIO)
// ==========================
app.get('/api/user/tickets', requireRole('user'), async (req, res) => {
  const { id: userId } = getAuth(req);
  let statusQuery = (req.query.status || 'aberto').toLowerCase();

  // Garantir que status seja válido
  const validStatuses = ['aberto', 'concluido'];
  if (!validStatuses.includes(statusQuery)) {
    statusQuery = 'aberto';
  }

  try {
    const pool = await connectDB();
    
    let query;
    const request = pool.request().input('userId', sql.Int, userId);

    // ✅ Se buscar "abertos", inclui AMBOS: aberto E aguardando_tecnico
    if (statusQuery === 'aberto') {
      query = `
        SELECT *
        FROM dbo.tickets
        WHERE user_id = @userId
          AND (status = 'aberto' OR status = 'aguardando_tecnico')
        ORDER BY id DESC
      `;
    } else {
      // ✅ Se buscar "concluido", filtra apenas concluídos
      query = `
        SELECT *
        FROM dbo.tickets
        WHERE user_id = @userId
          AND status = @status
        ORDER BY id DESC
      `;
      request.input('status', sql.NVarChar, statusQuery);
    }

    const result = await request.query(query);

    res.json({ ok: true, data: result.recordset });
  } catch (err) {
    console.error('Erro ao buscar chamados do usuário:', err);
    res.status(500).json({ ok: false, error: 'Erro ao buscar chamados' });
  }
});
// ==========================
// DETALHAR CHAMADO
// ==========================
app.get('/api/tickets/:id', requireRole('tech', 'user'), async (req, res) => {
  const ticketId = Number(req.params.id);
  const { id: userId, role } = getAuth(req);

  if (!ticketId) return res.status(400).json({ ok: false, error: 'ID inválido' });

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('id', sql.Int, ticketId)
      .query('SELECT * FROM dbo.tickets WHERE id=@id');

    if (!result.recordset.length) return res.status(404).json({ ok: false, error: 'Chamado não encontrado' });

    const ticket = result.recordset[0];
    if (!(role === 'tech' || ticket.user_id === userId))
      return res.status(403).json({ ok: false, error: 'Acesso negado' });

    res.json({ ok: true, data: ticket });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erro ao buscar chamado' });
  }
});

// ==========================
// ROTA: MARCAR CHAMADO COMO LIDO
// ==========================
app.patch('/api/tickets/:id/read', async (req, res) => {
  const { id } = req.params;
  const userRole = req.headers['x-user-role']; // 'user' ou 'tech'

  try {
    const pool = await connectDB();
    if (userRole === 'user') {
      await pool.request()
        .input('id', sql.Int, id)
        .query(`
          UPDATE messages
          SET read_by_user = 1
          WHERE ticket_id = @id
        `);
    } else if (userRole === 'tech') {
      await pool.request()
        .input('id', sql.Int, id)
        .query(`
          UPDATE messages
          SET read_by_tech = 1
          WHERE ticket_id = @id
        `);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao marcar mensagens como lidas:', err);
    res.status(500).json({ ok: false, error: 'Erro ao marcar mensagens como lidas' });
  }
});


// ==========================
// FINALIZAR CHAMADO 
// ==========================
app.patch('/api/tickets/:id/complete', requireRole('user', 'tech'), async (req, res) => {
  const ticketId = Number(req.params.id);
  if (!ticketId) return res.status(400).json({ ok: false, error: 'ID inválido' });

  try {
    const pool = await connectDB();
    const ticketRes = await pool.request()
      .input('id', sql.Int, ticketId)
      .query('SELECT user_id, status FROM dbo.tickets WHERE id=@id');

    if (!ticketRes.recordset.length)
      return res.status(404).json({ ok: false, error: 'Chamado não encontrado' });

    const ticket = ticketRes.recordset[0];
    const currentStatus = ticket.status.toLowerCase();
    const { id: userId, role } = getAuth(req);

    // Impedir que um usuário finalize chamado de outro usuário
    if (role === 'user' && ticket.user_id !== userId)
      return res.status(403).json({ ok: false, error: 'Você não pode finalizar chamados de outro usuário.' });

    // Permitir finalizar apenas se o status for aberto ou aguardando_tecnico
    if (!['aberto', 'aguardando_tecnico'].includes(currentStatus)) {
      return res.status(400).json({ ok: false, error: `Chamado com status "${currentStatus}" não pode ser finalizado.` });
    }

    // ✅ Determina se foi resolvido pela IA
    // Se o status for 'aberto', significa que nunca chamou técnico = IA resolveu
    const resolvidoPelaIA = currentStatus === 'aberto' ? 1 : 0;

    await pool.request()
      .input('id', sql.Int, ticketId)
      .input('userId', sql.Int, userId)
      .input('resolvidoPelaIA', sql.Bit, resolvidoPelaIA)
      .query(`
        UPDATE dbo.tickets
        SET status='concluido', 
            closed_at=GETDATE(), 
            closed_by=@userId,
            resolvido_pela_ia=@resolvidoPelaIA
        WHERE id=@id
      `);

    res.json({ ok: true, msg: 'Chamado finalizado com sucesso' });
  } catch (err) {
    console.error('Erro ao finalizar chamado:', err);
    res.status(500).json({ ok: false, error: 'Erro ao finalizar chamado', detalhes: err.message });
  }
});


// ==========================
// AJUDA PRESENCIAL
// ==========================
app.patch('/api/tickets/:id/help', requireRole('user'), async (req, res) => {
  const ticketId = Number(req.params.id);
  if (!ticketId) return res.status(400).json({ ok: false, error: 'ID inválido' });

  try {
    const pool = await connectDB();
    await pool.request()
      .input('id', sql.Int, ticketId)
      .query('UPDATE dbo.tickets SET ajuda_presencial = 1 WHERE id=@id');

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erro ao solicitar ajuda presencial' });
  }
});

// ==========================
// MENSAGENS (CHAT)
// ==========================
// ✅ Adiciona 'admin' na lista de roles permitidas
app.get('/api/tickets/:id/messages', requireRole('tech', 'user', 'admin'), async (req, res) => {
  const ticketId = Number(req.params.id);
  if (!ticketId) return res.status(400).json({ ok: false, error: 'ID inválido' });

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('ticket_id', sql.Int, ticketId)
      .query('SELECT * FROM dbo.messages WHERE ticket_id=@ticket_id ORDER BY created_at ASC');
    res.json({ ok: true, data: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erro ao buscar mensagens' });
  }
});

app.post('/api/tickets/:id/messages', requireRole('tech', 'user'), async (req, res) => {
  const ticketId = Number(req.params.id);
  const { id: userId, role } = getAuth(req);
  const { content, sender_role } = req.body ?? {};

  if (!ticketId) return res.status(400).json({ ok: false, error: 'ID inválido' });
  if (!content) return res.status(400).json({ ok: false, error: 'Mensagem vazia' });

  const finalRole = sender_role === 'IA' ? 'IA' : role;
  if (!['user', 'tech', 'IA'].includes(finalRole))
    return res.status(403).json({ ok: false, error: 'Função não permitida' });

  const senderId = finalRole === 'IA' ? IA_USER_ID : userId;

  try {
    const pool = await connectDB();
    await pool.request()
      .input('ticket_id', sql.Int, ticketId)
      .input('sender_id', sql.Int, senderId)
      .input('sender_role', sql.NVarChar, finalRole)
      .input('content', sql.NVarChar, content)
      .query('INSERT INTO dbo.messages (ticket_id, sender_id, sender_role, content, created_at) VALUES (@ticket_id, @sender_id, @sender_role, @content, GETDATE())');

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==========================
// CHAT COM IA
// ==========================
app.post('/api/tickets/:id/chat-ia', requireRole('user', 'tech', 'admin'), async (req, res) => {
  const ticketId = Number(req.params.id);
  const { pergunta } = req.body ?? {};

  if (!ticketId) return res.status(400).json({ ok: false, error: 'ID inválido' });
  if (!pergunta) return res.status(400).json({ ok: false, error: 'Pergunta vazia' });

  try {
    const pool = await connectDB();

    // Verifica status do chamado
    const ticketCheck = await pool.request()
      .input('ticketId', sql.Int, ticketId)
      .query('SELECT status FROM dbo.tickets WHERE id=@ticketId');

    if (!ticketCheck.recordset.length)
      return res.status(404).json({ ok: false, error: 'Chamado não encontrado' });

    const ticketStatus = ticketCheck.recordset[0].status?.toLowerCase();

    if (ticketStatus === 'aguardando_tecnico' || ticketStatus === 'em_atendimento') {
      return res.json({ ok: false, msg: 'IA desativada — técnico acionado.' });
    }

    const respostaIA = await perguntarIA(pergunta);

    const precisaChamarTecnico =
      respostaIA.toLowerCase().includes("não sei") ||
      respostaIA.toLowerCase().includes("não consigo") ||
      respostaIA.toLowerCase().includes("precisa de um técnico");

    if (precisaChamarTecnico) {
      await pool.request()
        .input('ticketId', sql.Int, ticketId)
        .input('novoStatus', sql.NVarChar, 'aguardando_tecnico')
        .query('UPDATE dbo.tickets SET status=@novoStatus WHERE id=@ticketId');
    }

    await pool.request()
      .input('ticket_id', sql.Int, ticketId)
      .input('sender_id', sql.Int, IA_USER_ID)
      .input('sender_role', sql.VarChar, 'IA')
      .input('content', sql.VarChar, respostaIA)
      .query(`
        INSERT INTO dbo.messages (ticket_id, sender_id, sender_role, content, created_at)
        VALUES (@ticket_id, @sender_id, @sender_role, @content, GETDATE())
      `);

    res.json({ ok: true, resposta: respostaIA, chamadoCriado: precisaChamarTecnico });
  } catch (err) {
    console.error('❌ Erro ao processar pedido da IA:', err);
    res.status(500).json({ ok: false, error: 'Erro ao processar pedido da IA', detalhes: err.message });
  }
});

// ==========================
// ALTERAR STATUS DO CHAMADO
// ==========================
app.patch('/api/tickets/:id/status', async (req, res) => {
  const ticketId = Number(req.params.id);
  const { status } = req.body ?? {};

  if (!ticketId || !status)
    return res.status(400).json({ ok: false, error: 'Parâmetros inválidos' });

  try {
    const pool = await connectDB();
    await pool.request()
      .input('ticketId', sql.Int, ticketId)
      .input('status', sql.NVarChar, status)
      .query('UPDATE dbo.tickets SET status=@status WHERE id=@ticketId');

    res.json({ ok: true, msg: 'Status atualizado com sucesso' });
  } catch (err) {
    console.error('Erro ao atualizar status:', err);
    res.status(500).json({ ok: false, error: 'Erro ao atualizar status', detalhes: err.message });
  }
});

// ==========================
// MÉTRICAS DO ADMIN
// ==========================
app.get('/api/metrics', requireRole('admin'), async (req, res) => {
  try {
    const pool = await connectDB();

    // Total de chamados
    const totalRes = await pool.request()
      .query('SELECT COUNT(*) as total FROM dbo.tickets');
    const total = totalRes.recordset[0].total;

    // Chamados abertos (inclui aberto e aguardando_tecnico)
    const abertosRes = await pool.request()
      .query("SELECT COUNT(*) as total FROM dbo.tickets WHERE status IN ('aberto', 'aguardando_tecnico')");
    const abertos = abertosRes.recordset[0].total;

    // Chamados concluídos
    const concluidosRes = await pool.request()
      .query("SELECT COUNT(*) as total FROM dbo.tickets WHERE status = 'concluido'");
    const concluidos = concluidosRes.recordset[0].total;

    // ✅ Chamados resolvidos pela IA
    const iaRes = await pool.request()
      .query("SELECT COUNT(*) as total FROM dbo.tickets WHERE resolvido_pela_ia = 1");
    const resolvidosPelaIA = iaRes.recordset[0].total;

    // Chamados por usuário
    const usuariosRes = await pool.request()
      .query(`
        SELECT nome_usuario, COUNT(*) as total
        FROM dbo.tickets
        GROUP BY nome_usuario
        ORDER BY total DESC
      `);
    const usuarios = usuariosRes.recordset;

    // Chamados por gravidade
    const gravidadesRes = await pool.request()
      .query(`
        SELECT gravidade, COUNT(*) as total
        FROM dbo.tickets
        GROUP BY gravidade
      `);
    const gravidades = gravidadesRes.recordset;

    res.json({
      ok: true,
      data: {
        total,
        abertos,
        concluidos,
        resolvidosPelaIA,
        usuarios,
        gravidades
      }
    });
  } catch (err) {
    console.error('Erro ao buscar métricas:', err);
    res.status(500).json({ ok: false, error: 'Erro ao buscar métricas', detalhes: err.message });
  }
});

// ==========================
// TRATAMENTO DE ROTA INVÁLIDA
// ==========================
app.use('/api/*', (req, res) => {
  res.status(404).json({ ok: false, error: 'Rota da API não encontrada' });
});

// ==========================
// SERVIDOR
// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`))
