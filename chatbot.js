/**
 * GS Studio Criativo — Chatbot WhatsApp
 * Evolution API — Webhook Handler
 * 
 * Cole este código no Railway como um serviço Node.js
 * ou use junto com a Evolution API via webhook.
 */

const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// ── CONFIGURAÇÕES ──────────────────────────────────────────
const CONFIG = {
  EVOLUTION_URL: process.env.EVOLUTION_URL || 'https://SUA-URL.up.railway.app',
  EVOLUTION_KEY: process.env.EVOLUTION_KEY || 'SUA_API_KEY',
  INSTANCE:      process.env.INSTANCE_NAME || 'gsstudio',
  GISELLE_NUMBER:  process.env.GISELLE_NUMBER  || '5511931449232',
  PORT:          process.env.PORT           || 3000,
};

// ── FLUXO DE CONVERSA ──────────────────────────────────────
const FLOW = {
  inicio: {
    msg: `Olá! 👋 Seja bem-vindo(a) à *GS Studio Criativo*!\n\nSou a assistente virtual e vou entender o que você precisa. Em seguida o *Giselle* entra em contato para fechar. 😊\n\nQual produto você está buscando?\n\n*1* — Convites e festas 🎉\n*2* — Banners e lonas 🖼️\n*3* — Cartões de visita 💼\n*4* — Adesivos e etiquetas 🏷️\n*5* — Brindes personalizados 🎁\n*6* — Outro produto`,
    opcoes: {
      '1': 'Convites e festas 🎉',
      '2': 'Banners e lonas 🖼️',
      '3': 'Cartões de visita 💼',
      '4': 'Adesivos e etiquetas 🏷️',
      '5': 'Brindes personalizados 🎁',
      '6': 'Outro produto',
    },
    proximo: 'arte',
    campo: 'produto',
  },
  arte: {
    msg: `Ótima escolha! 🎨\n\nVocê já tem uma arte pronta ou vai precisar que a gente crie o layout?\n\n*1* — Já tenho arte pronta ✅\n*2* — Preciso que criem para mim 🎨\n*3* — Ainda não sei`,
    opcoes: {
      '1': 'Já tenho arte pronta ✅',
      '2': 'Preciso que criem para mim 🎨',
      '3': 'Ainda não sei',
    },
    proximo: 'quantidade',
    campo: 'arte',
  },
  quantidade: {
    msg: `Entendido! Qual a *quantidade aproximada* do pedido?\n\n*1* — Até 50 unidades\n*2* — 51 a 200 unidades\n*3* — 201 a 500 unidades\n*4* — Mais de 500 unidades\n*5* — Ainda não sei`,
    opcoes: {
      '1': 'Até 50 unidades',
      '2': '51 a 200 unidades',
      '3': '201 a 500 unidades',
      '4': 'Mais de 500 unidades',
      '5': 'Ainda não sei',
    },
    proximo: 'prazo',
    campo: 'quantidade',
  },
  prazo: {
    msg: `Certo! ⏱️ Qual é o seu *prazo* para receber?\n\n*1* — Urgente — até 48h 🔥\n*2* — Essa semana\n*3* — Próxima semana\n*4* — Tenho bastante tempo`,
    opcoes: {
      '1': 'Urgente — até 48h 🔥',
      '2': 'Essa semana',
      '3': 'Próxima semana',
      '4': 'Tenho bastante tempo',
    },
    proximo: 'nome',
    campo: 'prazo',
  },
  nome: {
    msg: `Quase lá! 😊\n\nQual é o seu *nome completo*?`,
    opcoes: null, // texto livre
    proximo: 'telefone',
    campo: 'nome',
  },
  telefone: {
    msg: `Obrigada! Pode me passar um *número de contato* com DDD?\n_(pode ser este mesmo ou outro)_`,
    opcoes: null, // texto livre
    proximo: 'finalizar',
    campo: 'telefone',
  },
};

// ── ESTADO DOS CLIENTES EM MEMÓRIA ─────────────────────────
// { "5511999999999": { etapa: "inicio", dados: {} } }
const sessoes = {};

function getSessao(numero) {
  if (!sessoes[numero]) {
    sessoes[numero] = { etapa: 'inicio', dados: {} };
  }
  return sessoes[numero];
}

function resetarSessao(numero) {
  delete sessoes[numero];
}

// ── ENVIAR MENSAGEM ────────────────────────────────────────
async function enviar(numero, texto) {
  try {
    await axios.post(
      `${CONFIG.EVOLUTION_URL}/message/sendText/${CONFIG.INSTANCE}`,
      { number: numero, text: texto },
      { headers: { apikey: CONFIG.EVOLUTION_KEY } }
    );
  } catch (e) {
    console.error('Erro ao enviar mensagem:', e.message);
  }
}

// ── NOTIFICAR GISELLE ────────────────────────────────────────
async function notificarGiselle(dados, numeroCliente) {
  const msg =
`🔔 *Novo pedido qualificado!*
_GS Studio Criativo_

👤 *Cliente:* ${dados.nome || '—'}
📱 *WhatsApp:* ${dados.telefone || numeroCliente}

🛍️ *Produto:* ${dados.produto || '—'}
🎨 *Arte:* ${dados.arte || '—'}
📦 *Quantidade:* ${dados.quantidade || '—'}
⏱️ *Prazo:* ${dados.prazo || '—'}

_Cliente pronto para fechar! Responda quando quiser:_
👉 https://wa.me/${dados.telefone ? '55'+dados.telefone.replace(/\D/g,'') : numeroCliente}`;

  await enviar(CONFIG.GISELLE_NUMBER, msg);
}

// ── PROCESSAR MENSAGEM RECEBIDA ────────────────────────────
async function processar(numero, textoOriginal) {
  const texto = textoOriginal.trim();
  const sessao = getSessao(numero);

  // Palavras que reiniciam a conversa
  const reiniciar = ['oi','olá','ola','ola!','oi!','bom dia','boa tarde','boa noite','menu','inicio','início','reiniciar'];
  if (reiniciar.includes(texto.toLowerCase()) && sessao.etapa !== 'inicio') {
    resetarSessao(numero);
    const nova = getSessao(numero);
    await enviar(numero, FLOW['inicio'].msg);
    nova.etapa = 'arte'; // próxima etapa após início
    return;
  }

  const etapaAtual = sessao.etapa;

  // ── Etapa de início (primeira mensagem) ──
  if (etapaAtual === 'inicio') {
    await enviar(numero, FLOW['inicio'].msg);
    sessao.etapa = 'arte';
    return;
  }

  // ── Etapa de finalização ──
  if (etapaAtual === 'finalizar') return;

  // ── Etapas intermediárias ──
  const etapa = FLOW[etapaAtual];
  if (!etapa) return;

  // Resolver resposta — número ou texto livre
  let valorSalvo = texto;
  if (etapa.opcoes && etapa.opcoes[texto]) {
    valorSalvo = etapa.opcoes[texto];
  }

  // Salvar resposta
  sessao.dados[etapa.campo] = valorSalvo;

  // Avançar
  const proxima = etapa.proximo;

  if (proxima === 'finalizar') {
    // Confirmação para o cliente
    await enviar(numero,
`✅ *Perfeito, ${sessao.dados.nome || 'cliente'}!*

Registrei seu pedido:\n
🛍️ ${sessao.dados.produto}
🎨 ${sessao.dados.arte}
📦 ${sessao.dados.quantidade}
⏱️ ${sessao.dados.prazo}\n
O *Giselle* vai entrar em contato em breve com o orçamento! 🙌\nObrigada pela preferência na *GS Studio Criativo*! 💚`
    );

    // Notifica Giselle
    await notificarGiselle(sessao.dados, numero);

    // Marca como finalizado
    sessao.etapa = 'finalizar';

  } else {
    // Enviar próxima pergunta
    await enviar(numero, FLOW[proxima].msg);
    sessao.etapa = proxima;
  }
}

// ── WEBHOOK ────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // responde rápido para a Evolution API

  try {
    const body = req.body;

    // Formato Evolution API v2
    const evento = body?.event;
    if (evento !== 'messages.upsert') return;

    const msg = body?.data?.messages?.[0];
    if (!msg) return;

    // Ignorar mensagens enviadas pelo próprio bot
    if (msg.key?.fromMe) return;

    // Ignorar grupos
    const remoteJid = msg.key?.remoteJid || '';
    if (remoteJid.includes('@g.us')) return;

    const numero = remoteJid.replace('@s.whatsapp.net', '');
    const texto  = msg.message?.conversation
                || msg.message?.extendedTextMessage?.text
                || '';

    if (!texto) return;

    await processar(numero, texto);

  } catch (err) {
    console.error('Erro no webhook:', err.message);
  }
});

// ── HEALTH CHECK ───────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'GS Studio Bot online ✅' }));

app.listen(CONFIG.PORT, () => {
  console.log(`🤖 GS Studio Bot rodando na porta ${CONFIG.PORT}`);
});
