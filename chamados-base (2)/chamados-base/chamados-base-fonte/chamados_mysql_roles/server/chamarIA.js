// ==========================
// CHAT COM IA
// ==========================
app.post('/api/tickets/:id/chat-ia', requireRole('user'), async (req, res) => {
  const { id: ticketId } = req.params;
  const { pergunta } = req.body;

  if (!pergunta) {
    console.warn("⚠️ Pergunta vazia recebida no endpoint");
    return res.status(400).json({ ok: false, error: 'Pergunta vazia' });
  }

  console.log(`💬 Pergunta recebida para ticket #${ticketId}:`, pergunta);

  try {
    const respostaIA = await perguntarIA(pergunta);
    console.log(`🤖 Resposta da IA para ticket #${ticketId}:`, respostaIA);

    const precisaChamarTecnico = respostaIA.toLowerCase().includes("não sei") ||
                                 respostaIA.toLowerCase().includes("não consigo");

    if (precisaChamarTecnico) {
      const pool = await connectDB();
      await pool.request()
        .input('userId', sql.Int, 0)
        .input('nome_usuario', sql.NVarChar, 'IA')
        .input('gravidade', sql.NVarChar, 'média')
        .input('descricao', sql.NVarChar, pergunta)
        .input('status', sql.NVarChar, 'aberto')
        .query(`INSERT INTO dbo.tickets (user_id, nome_usuario, gravidade, descricao, status, ajuda_presencial, created_at)
                VALUES (@userId, @nome_usuario, @gravidade, @descricao, @status, 0, GETDATE())`);
      console.log(`📌 Chamado criado automaticamente pela IA para ticket #${ticketId}`);
    }

    res.json({ ok: true, resposta: respostaIA, chamadoCriado: precisaChamarTecnico });
  } catch (err) {
    console.error("❌ Erro no endpoint chat-ia:", err);
    res.status(500).json({ ok: false, error: 'Erro ao consultar IA' });
  }
});
