/**
 * GS Studio Criativo — Chatbot WhatsApp
 * Evolution API — Webhook Handler
 * Versão limpa — sem e-mail, sem banco de dados
 */

const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const CONFIG = {
  EVOLUTION_URL:  process.env.EVOLUTION_URL  || 'https://evolution-api-production-935a.up.railway.app',
  EVOLUTION_KEY:  process.env.EVOLUTION_KEY  || '',
  INSTANCE:       process.env.INSTANCE_NAME  || 'GSstudio',
  GISELLE_NUMBER: process.env.GISELLE_NUMBER || '5511931449232',
  PORT:           process.env.PORT           || 3000,
};

const sessoes = {};

function getSessao(numero) {
  if (!sessoes[numero]) sessoes[numero] = { etapa: 'MENU', historico: [], dados: {} };
  return sessoes[numero];
}

function resetarSessao(numero) {
  sessoes[numero] = { etapa: 'MENU', historico: [], dados: {} };
}

async function enviar(numero, texto) {
  try {
    await axios.post(
      `${CONFIG.EVOLUTION_URL}/message/sendText/${CONFIG.INSTANCE}`,
      { number: numero, text: texto },
      { headers: { apikey: CONFIG.EVOLUTION_KEY } }
    );
    console.log('Mensagem enviada para:', numero);
  } catch (e) {
    console.error('Erro ao enviar:', e.message);
  }
}

async function notificarGiselle(dados, numero) {
  const linhas = Object.entries(dados)
    .filter(([k]) => !k.startsWith('_'))
    .map(([k, v]) => `${k}: ${v}`).join('\n');
  await enviar(CONFIG.GISELLE_NUMBER,
`🔔 *Novo pedido — GS Studio Criativo*

${linhas}

📱 Cliente: ${numero}
_Pronto para fechar!_`);
}

// ── FLUXO ──────────────────────────────────────────────────

async function mostrarMenu(numero) {
  const s = getSessao(numero);
  s.etapa = 'MENU';
  await enviar(numero,
`Olá! 👋 Bem-vindo(a) à *GS Studio Criativo*!

Sou a assistente virtual. Vou ajudar a montar seu orçamento! 😊

O que você procura?

*1* — Adesivos
*2* — Tags
*3* — Fotos
*4* — Encadernação
*5* — Outro

_Digite o número da opção._`);
}

async function handleEtapa(numero, txt) {
  const s = getSessao(numero);
  const low = txt.toLowerCase().trim();

  // Voltar
  if (low === 'voltar' || txt === '0') {
    if (s.historico.length > 0) s.etapa = s.historico.pop();
    else s.etapa = 'MENU';
    await despachar(numero);
    return;
  }

  switch (s.etapa) {

    case 'MENU': {
      if (txt === '1' || /adesivo/i.test(txt)) {
        s.dados.categoria = 'Adesivos'; s.historico.push('MENU'); s.etapa = 'TAMANHO';
        await enviar(numero, `Qual *tamanho* você deseja?\n\n*1* — 2cm\n*2* — 3cm\n*3* — 4cm\n*4* — 5cm\n*5* — 6cm\n*6* — 7cm\n*7* — 8cm\n*8* — Outro tamanho\n\n_Digite *voltar* para retornar._`);
      } else if (txt === '2' || /tag/i.test(txt)) {
        s.dados.categoria = 'Tags'; s.historico.push('MENU'); s.etapa = 'TAMANHO';
        await enviar(numero, `Qual *tamanho* você deseja?\n\n*1* — 2cm\n*2* — 3cm\n*3* — 4cm\n*4* — 5cm\n*5* — 6cm\n*6* — 7cm\n*7* — 8cm\n*8* — Outro tamanho\n\n_Digite *voltar* para retornar._`);
      } else if (txt === '3' || /foto/i.test(txt)) {
        s.dados.categoria = 'Fotos'; s.historico.push('MENU'); s.etapa = 'FOTO_IMA';
        await enviar(numero, `Você deseja as fotos *com ímã ou sem ímã*?\n\n*1* — Com ímã\n*2* — Sem ímã\n\n_Digite *voltar* para retornar._`);
      } else if (txt === '4' || /encad/i.test(txt)) {
        s.dados.categoria = 'Encadernação'; s.historico.push('MENU'); s.etapa = 'ENCAD';
        await enviar(numero, `Qual *produto* você deseja?\n\n*1* — Caderno A5\n*2* — Agenda A5\n*3* — Caderneta de Vacinação A5\n*4* — Kit Bebê\n*5* — Outro\n\n_Digite *voltar* para retornar._`);
      } else if (txt === '5' || /outro/i.test(txt)) {
        s.dados.categoria = 'Outro'; s.historico.push('MENU'); s.etapa = 'OUTRO';
        await enviar(numero, `Descreva o *produto ou serviço* que você procura:\n\n_Digite *voltar* para retornar._`);
      } else {
        await enviar(numero, 'Digite o número da opção desejada (1 a 5) 😊');
      }
      break;
    }

    case 'TAMANHO': {
      const tam = {'1':'2cm','2':'3cm','3':'4cm','4':'5cm','5':'6cm','6':'7cm','7':'8cm','8':'Outro'};
      const val = tam[txt] || txt;
      s.dados.tamanho = val;
      s.historico.push('TAMANHO');
      if (val === 'Outro') {
        s.etapa = 'TAMANHO_OUTRO';
        await enviar(numero, `Qual a *largura e altura* desejadas?\nEx: *5x8cm*, *10x15cm*\n\n_Digite *voltar* para retornar._`);
      } else {
        s.etapa = 'FORMATO';
        await enviar(numero, `Qual *formato* você deseja?\n\n*1* — Redondo\n*2* — Quadrado\n\n_Digite *voltar* para retornar._`);
      }
      break;
    }

    case 'TAMANHO_OUTRO': {
      s.dados.tamanho = txt;
      await finalizar(numero);
      break;
    }

    case 'FORMATO': {
      const fmt = {'1':'Redondo','2':'Quadrado','redondo':'Redondo','quadrado':'Quadrado'};
      s.dados.formato = fmt[low] || txt;
      s.historico.push('FORMATO'); s.etapa = 'LAMINACAO';
      await enviar(numero, `Você deseja *laminação*?\n\n*1* — Sim\n*2* — Não\n\n_Digite *voltar* para retornar._`);
      break;
    }

    case 'LAMINACAO': {
      s.dados.laminacao = (txt==='1'||/sim/i.test(txt)) ? 'Sim' : 'Não';
      await finalizar(numero);
      break;
    }

    case 'FOTO_IMA': {
      s.dados.ima = (txt==='1'||/com/i.test(txt)) ? 'Com ímã' : 'Sem ímã';
      s.historico.push('FOTO_IMA'); s.etapa = 'FOTO_MODELO';
      await enviar(numero, `Qual *modelo de foto*?\n\n*1* — Foto Normal A6\n*2* — Foto Polaroid 7x9cm\n*3* — Foto Mini Polaroid 3,5x4cm\n*4* — Foto Tirinha 5x20cm\n*5* — Outro modelo\n\n_Digite *voltar* para retornar._`);
      break;
    }

    case 'FOTO_MODELO': {
      const mod = {'1':'Foto Normal A6','2':'Foto Polaroid 7x9cm','3':'Foto Mini Polaroid 3,5x4cm','4':'Foto Tirinha 5x20cm','5':'Outro'};
      const val = mod[txt] || txt;
      s.dados.modelo = val;
      if (val === 'Outro') {
        s.historico.push('FOTO_MODELO'); s.etapa = 'FOTO_OUTRO';
        await enviar(numero, `Descreva o modelo ou informe as medidas:\n\n_Digite *voltar* para retornar._`);
      } else {
        // Mostrar valores
        const ima = s.dados.ima;
        let valores = '';
        if (val === 'Foto Polaroid 7x9cm') valores = ima === 'Com ímã' ? '• Unidade: R$ 4,50\n• Kit 8 fotos: R$ 30,00' : '• Unidade: R$ 3,50\n• Kit 8 fotos: R$ 25,00';
        else if (val === 'Foto Mini Polaroid 3,5x4cm') valores = ima === 'Com ímã' ? '• Kit 35 fotos: R$ 30,00' : '• Kit 35 fotos: R$ 25,00';
        else if (val === 'Foto Tirinha 5x20cm') valores = ima === 'Com ímã' ? '• Kit 5 fotos: R$ 30,00' : '• Kit 5 fotos: R$ 25,00';
        else valores = '• Preço sob consulta';
        s.etapa = 'FOTO_CONFIRMAR';
        await enviar(numero, `💰 *${val} — ${ima}*\n\n${valores}\n\nDeseja encomendar?\n*1* — Sim!\n*2* — Voltar ao menu`);
      }
      break;
    }

    case 'FOTO_OUTRO': {
      s.dados.modelo = txt;
      await finalizar(numero);
      break;
    }

    case 'FOTO_CONFIRMAR': {
      if (txt === '1' || /sim/i.test(txt)) {
        s.etapa = 'NOME';
        await enviar(numero, `Qual é o seu *nome completo*?`);
      } else {
        resetarSessao(numero);
        await mostrarMenu(numero);
      }
      break;
    }

    case 'ENCAD': {
      const prod = {'1':'Caderno A5','2':'Agenda A5','3':'Caderneta de Vacinação A5','4':'Kit Bebê','5':'Outro'};
      s.dados.produto = prod[txt] || txt;
      s.historico.push('ENCAD');
      if (txt==='1') { s.etapa='CADERNO_MIOLO'; await enviar(numero, `Tipo de *miolo*?\n\n*1* — Pautado\n*2* — Pontilhado\n*3* — Sem pauta\n\n_Digite *voltar* para retornar._`); }
      else if (txt==='2') { s.etapa='AGENDA_MODELO'; await enviar(numero, `Modelo da *agenda*?\n\n*1* — Dois dias por página\n*2* — Um dia por página\n\n_Digite *voltar* para retornar._`); }
      else if (txt==='3') { s.etapa='VACINA_TIPO'; await enviar(numero, `Deseja *restauração* ou *nova*?\n\n*1* — Restauração\n*2* — Nova\n\n_Digite *voltar* para retornar._`); }
      else if (txt==='4') { s.etapa='TEMA'; await enviar(numero, `Qual o *tema ou personalização* para o Kit Bebê?\n\n_Digite *voltar* para retornar._`); }
      else { s.etapa='ENCAD_OUTRO'; await enviar(numero, `Descreva o produto de encadernação desejado:\n\n_Digite *voltar* para retornar._`); }
      break;
    }

    case 'CADERNO_MIOLO': {
      const m = {'1':'Pautado','2':'Pontilhado','3':'Sem pauta'};
      s.dados.miolo = m[txt] || txt;
      s.historico.push('CADERNO_MIOLO'); s.etapa = 'TEMA';
      await enviar(numero, `Qual o *tema ou personalização* para o Caderno A5?\n\n_Digite *voltar* para retornar._`);
      break;
    }

    case 'AGENDA_MODELO': {
      s.dados.modeloAgenda = txt==='1' ? 'Dois dias por página' : 'Um dia por página';
      s.historico.push('AGENDA_MODELO'); s.etapa = 'AGENDA_TIPO';
      await enviar(numero, `A agenda será *datada ou permanente*?\n\n*1* — Datada\n*2* — Permanente\n\n_Digite *voltar* para retornar._`);
      break;
    }

    case 'AGENDA_TIPO': {
      s.dados.tipoAgenda = txt==='1' ? 'Datada' : 'Permanente';
      s.historico.push('AGENDA_TIPO'); s.etapa = 'TEMA';
      await enviar(numero, `Qual o *tema ou personalização* para a Agenda A5?\n\n_Digite *voltar* para retornar._`);
      break;
    }

    case 'VACINA_TIPO': {
      s.dados.tipoVacina = txt==='1' ? 'Restauração' : 'Nova';
      s.historico.push('VACINA_TIPO'); s.etapa = 'TEMA';
      await enviar(numero, `Qual o *tema ou personalização* para a Caderneta?\n\n_Digite *voltar* para retornar._`);
      break;
    }

    case 'TEMA': {
      s.dados.tema = txt;
      await finalizar(numero);
      break;
    }

    case 'ENCAD_OUTRO': {
      s.dados.descricao = txt;
      await finalizar(numero);
      break;
    }

    case 'OUTRO': {
      s.dados.descricao = txt;
      await finalizar(numero);
      break;
    }

    case 'NOME': {
      s.dados.nome = txt;
      s.etapa = 'CONTATO';
      await enviar(numero, `Pode me passar um *número de contato* com DDD?\n_(pode ser este mesmo ou outro)_`);
      break;
    }

    case 'CONTATO': {
      s.dados.contato = txt;
      await confirmar(numero);
      break;
    }

    default:
      await mostrarMenu(numero);
  }
}

async function despachar(numero) {
  const s = getSessao(numero);
  if (s.etapa === 'MENU') return mostrarMenu(numero);
  await handleEtapa(numero, '');
}

async function finalizar(numero) {
  const s = getSessao(numero);
  s.etapa = 'NOME';
  await enviar(numero, `✅ Anotei tudo! Qual é o seu *nome completo*?`);
}

async function confirmar(numero) {
  const s = getSessao(numero);
  const d = s.dados;
  const linhas = Object.entries(d)
    .filter(([k]) => !k.startsWith('_'))
    .map(([k, v]) => `• *${k}:* ${v}`).join('\n');

  await enviar(numero,
`🎉 *Pedido registrado!*

📋 *Resumo:*
${linhas}

A *Giselle* entrará em contato com o orçamento! 💚
Obrigada pela preferência na *GS Studio Criativo*! 🛍️`);

  await notificarGiselle(d, numero);
  resetarSessao(numero);
}

// ── WEBHOOK ────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    console.log('Webhook recebido:', JSON.stringify(body).slice(0, 300));

    const evento = body?.event || body?.evento || '';
    console.log('Evento:', evento, '| Body keys:', Object.keys(body || {}));

    // Ignora eventos que não são de mensagem
    if (evento && !evento.toLowerCase().includes('message')) return;

    // Tenta extrair a mensagem de vários formatos possíveis
    const msg = body?.data?.messages?.[0]
             || (Array.isArray(body?.data) ? body.data[0] : body?.data)
             || body?.messages?.[0]
             || null;

    if (!msg) {
      console.log('Sem mensagem no body');
      return;
    }

    const fromMe = msg.key?.fromMe || msg.fromMe || false;
    if (fromMe) return;

    const remoteJid = msg.key?.remoteJid || msg.remoteJid || '';
    if (!remoteJid || remoteJid.includes('@g.us')) return;

    const numero = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
    const texto = msg.message?.conversation
               || msg.message?.extendedTextMessage?.text
               || msg.text || msg.body || '';

    console.log('Número:', numero, '| Texto:', texto);
    if (!numero || !texto) return;

    const s = getSessao(numero);
    const low = texto.toLowerCase().trim();
    const reiniciar = ['oi','olá','ola','bom dia','boa tarde','boa noite','menu','inicio','início'];
    if (reiniciar.includes(low)) {
      resetarSessao(numero);
      await mostrarMenu(numero);
      return;
    }

    await handleEtapa(numero, texto.trim());
  } catch (err) {
    console.error('Erro:', err.message);
  }
});

app.get('/', (req, res) => res.json({ status: 'GS Studio Bot online ✅' }));

app.listen(CONFIG.PORT, () => {
  console.log(`🤖 GS Studio Bot rodando na porta ${CONFIG.PORT}`);
});
