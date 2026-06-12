/**
 * GS Studio Criativo — Chatbot WhatsApp
 * Evolution API — Webhook Handler
 */

const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── CONFIGURAÇÕES ──────────────────────────────────────────
const CONFIG = {
  EVOLUTION_URL:  process.env.EVOLUTION_URL  || 'https://evolution-api-production-935a.up.railway.app',
  EVOLUTION_KEY:  process.env.EVOLUTION_KEY  || '',
  INSTANCE:       process.env.INSTANCE_NAME  || 'gsstudio',
  GISELLE_NUMBER: process.env.GISELLE_NUMBER || '5511989519437',
  EMAIL_USER:     process.env.EMAIL_USER     || 'criativogsstudio@gmail.com',
  EMAIL_PASS:     process.env.EMAIL_PASS     || '',
  EMAIL_TO:       'criativogsstudio@gmail.com',
  PORT:           process.env.PORT           || 3000,
};

// ── NODEMAILER ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: CONFIG.EMAIL_USER, pass: CONFIG.EMAIL_PASS },
});

// ── ESTADO DAS SESSÕES ─────────────────────────────────────
const sessoes = {};

function getSessao(numero) {
  if (!sessoes[numero]) {
    sessoes[numero] = { etapa: 'MENU', historico: [], dados: {}, nova: true };
  }
  return sessoes[numero];
}

function resetarSessao(numero) {
  sessoes[numero] = { etapa: 'MENU', historico: [], dados: {}, nova: false };
}

// ── ENVIAR MENSAGEM WHATSAPP ───────────────────────────────
async function enviar(numero, texto) {
  try {
    await axios.post(
      `${CONFIG.EVOLUTION_URL}/message/sendText/${CONFIG.INSTANCE}`,
      { number: numero, text: texto },
      { headers: { apikey: CONFIG.EVOLUTION_KEY } }
    );
  } catch (e) {
    console.error('Erro ao enviar WPP:', e.message);
  }
}

// ── ENVIAR E-MAIL ──────────────────────────────────────────
async function enviarEmail(dados, numero) {
  if (!CONFIG.EMAIL_PASS) return;

  const linhas = Object.entries(dados)
    .map(([k, v]) => `<tr><td style="padding:6px 12px;color:#666;font-size:13px">${k}</td><td style="padding:6px 12px;font-weight:600;font-size:13px">${v}</td></tr>`)
    .join('');

  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
      <div style="background:#128C7E;padding:20px;border-radius:10px 10px 0 0">
        <h2 style="color:#fff;margin:0">🛍️ Novo Pedido — GS Studio Criativo</h2>
      </div>
      <div style="border:1px solid #e0e0e0;border-top:none;border-radius:0 0 10px 10px;padding:20px">
        <p style="color:#444;font-size:14px">Um novo cliente finalizou o atendimento automático:</p>
        <table style="width:100%;border-collapse:collapse;margin-top:10px">
          <tr style="background:#f5f5f5">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#888">Campo</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#888">Resposta</th>
          </tr>
          ${linhas}
        </table>
        <div style="margin-top:20px;padding:14px;background:#E8F5E9;border-radius:8px">
          <p style="margin:0;font-size:13px;color:#2E7D32">
            📱 WhatsApp do cliente: <strong>${numero}</strong><br>
            <a href="https://wa.me/${numero}" style="color:#128C7E">Clique aqui para responder</a>
          </p>
        </div>
      </div>
    </div>`;

  try {
    await transporter.sendMail({
      from: `"GS Studio Bot" <${CONFIG.EMAIL_USER}>`,
      to: CONFIG.EMAIL_TO,
      subject: '🔔 Novo pedido — GS Studio Criativo',
      html,
    });
    console.log('E-mail enviado!');
  } catch (e) {
    console.error('Erro ao enviar e-mail:', e.message);
  }
}

// ── NOTIFICAR GISELLE ──────────────────────────────────────
async function notificarGiselle(dados, numero) {
  const numLimpo = numero.replace(/\D/g, '');
  const ddd = numLimpo.slice(2, 4);
  const tel = numLimpo.slice(4);
  const telFormatado = tel.length === 9
    ? `${tel.slice(0,5)}-${tel.slice(5)}`
    : `${tel.slice(0,4)}-${tel.slice(4)}`;
  const numeroExibicao = `${ddd} ${telFormatado}`;
  const linkWpp = `https://wa.me/${numLimpo}`;

  const campos = {
    categoria:       '🛍️ *Produto*',
    produto:         '📦 *Item*',
    tamanho:         '📐 *Tamanho*',
    formato:         '⬜ *Formato*',
    laminacao:       '✨ *Laminação*',
    ima:             '🧲 *Ímã*',
    modelo:          '📸 *Modelo*',
    miolo:           '📄 *Miolo*',
    modeloAgenda:    '📅 *Modelo agenda*',
    tipoAgenda:      '🗓️ *Tipo agenda*',
    tipoVacina:      '💉 *Tipo*',
    tema:            '🎨 *Tema*',
    descricao:       '📝 *Descrição*',
    arte:            '🖼️ *Arte*',
    itensAdicionais: '➕ *Itens adicionais*',
    nome:            '👤 *Cliente*',
    contato:         '📱 *Contato*',
  };

  const linhas = Object.entries(campos)
    .filter(([k]) => dados[k])
    .map(([k, label]) => `${label}: ${dados[k]}`)
    .join('\n');

  const msg =
`🔔 *Novo pedido qualificado!*
_GS Studio Criativo_

${linhas}
📱 *WhatsApp:* ${numeroExibicao}

_Cliente pronto para fechar! Responda quando quiser:_
👉 ${linkWpp}`;

  await enviar(CONFIG.GISELLE_NUMBER, msg);
  await enviarEmail({ ...dados, 'WhatsApp': numeroExibicao }, numero);
}

// ══════════════════════════════════════════════════════════
//  FLUXO DE CONVERSA
// ══════════════════════════════════════════════════════════

async function processar(numero, texto) {
  const s = getSessao(numero);
  const txt = texto.trim();
  const low = txt.toLowerCase();

  // Após pedido finalizado, só reativa com "pedido finalizado" enviado pela Giselle (fromMe)
  if (s.etapa === 'FINALIZADO') return;

  const palavrasReinicio = ['oi','olá','ola','bom dia','boa tarde','boa noite','menu','inicio','início','reiniciar','recomeçar'];
  if (palavrasReinicio.includes(low)) {
    resetarSessao(numero);
    await mostrarMenu(numero);
    return;
  }

  if (low === 'voltar' || txt === '0') {
    if (s.historico.length > 0) {
      s.etapa = s.historico.pop();
    }
    await despachar(numero);
    return;
  }

  await handleEtapa(numero, txt);
}

// ── MENU PRINCIPAL ─────────────────────────────────────────
async function mostrarMenu(numero) {
  const s = getSessao(numero);
  s.etapa = 'MENU';
  await enviar(numero,
`Olá! 👋 Bem-vindo(a) à *GS Studio Criativo*!

Sou a assistente virtual da Giselle. Vou te ajudar a montar seu orçamento! 😊

O que você está procurando?

*1* — Adesivos
*2* — Tags
*3* — Fotos
*4* — Encadernação
*5* — Outro

_Digite o número ou o nome da opção._`);
}

// ── DESPACHAR ──────────────────────────────────────────────
async function despachar(numero) {
  const s = getSessao(numero);
  switch(s.etapa) {
    case 'MENU':                return mostrarMenu(numero);
    case 'ADESIVO_TAMANHO':     return perguntarAdesivoTamanho(numero);
    case 'ADESIVO_OUTRO_TAMANHO': return perguntarAdesivoOutroTamanho(numero);
    case 'ADESIVO_FORMATO':     return perguntarAdesivoFormato(numero);
    case 'ADESIVO_LAMINACAO':   return perguntarAdesivoLaminacao(numero);
    case 'FOTO_IMA':            return perguntarFotoIma(numero);
    case 'FOTO_MODELO':         return perguntarFotoModelo(numero);
    case 'FOTO_OUTRO_MODELO':   return perguntarFotoOutroModelo(numero);
    case 'ENCAD_PRODUTO':       return perguntarEncadProduto(numero);
    case 'ENCAD_CADERNO_MIOLO': return perguntarCadernoMiolo(numero);
    case 'ENCAD_CADERNO_TEMA':  return perguntarTema(numero, 'Caderno A5');
    case 'ENCAD_AGENDA_MODELO': return perguntarAgendaModelo(numero);
    case 'ENCAD_AGENDA_TIPO':   return perguntarAgendaTipo(numero);
    case 'ENCAD_AGENDA_TEMA':   return perguntarTema(numero, 'Agenda A5');
    case 'ENCAD_VACINA_TIPO':   return perguntarVacinaTipo(numero);
    case 'ENCAD_VACINA_TEMA':   return perguntarTema(numero, 'Caderneta de Vacinação');
    case 'ENCAD_KIT_TEMA':      return perguntarTema(numero, 'Kit Bebê');
    case 'ENCAD_OUTRO':         return perguntarEncadOutro(numero);
    case 'OUTRO_DESC':          return perguntarOutroDesc(numero);
    case 'ARTE_PERGUNTA':       return perguntarArte(numero);
    case 'NOVA_PECA_PERGUNTA':  return perguntarNovaPeca(numero);
    case 'NOVA_PECA_DESC':      return perguntarNovaPecaDesc(numero);
    case 'COLETAR_NOME':        return perguntarNome(numero);
    case 'COLETAR_CONTATO':     return perguntarContato(numero);
    default:                    return mostrarMenu(numero);
  }
}

// ── HANDLER PRINCIPAL ──────────────────────────────────────
async function handleEtapa(numero, txt) {
  const s = getSessao(numero);

  switch(s.etapa) {

    // ── MENU ──
    case 'MENU': {
      const op = txt.replace(/[^1-5]/g,'');
      if (op === '1' || /adesivo/i.test(txt)) {
        s.dados.categoria = 'Adesivos';
        s.historico.push('MENU');
        s.etapa = 'ADESIVO_TAMANHO';
        await perguntarAdesivoTamanho(numero);
      } else if (op === '2' || /tag/i.test(txt)) {
        s.dados.categoria = 'Tags';
        s.historico.push('MENU');
        s.etapa = 'ADESIVO_TAMANHO';
        await perguntarAdesivoTamanho(numero);
      } else if (op === '3' || /foto/i.test(txt)) {
        s.dados.categoria = 'Fotos';
        s.historico.push('MENU');
        s.etapa = 'FOTO_IMA';
        await perguntarFotoIma(numero);
      } else if (op === '4' || /encad/i.test(txt)) {
        s.dados.categoria = 'Encadernação';
        s.historico.push('MENU');
        s.etapa = 'ENCAD_PRODUTO';
        await perguntarEncadProduto(numero);
      } else if (op === '5' || /outro/i.test(txt)) {
        s.dados.categoria = 'Outro';
        s.historico.push('MENU');
        s.etapa = 'OUTRO_DESC';
        await perguntarOutroDesc(numero);
      } else {
        await mostrarMenu(numero);
      }
      break;
    }

    // ── ADESIVOS/TAGS — TAMANHO ──
    case 'ADESIVO_TAMANHO': {
      const tamanhos = {'1':'2 cm','2':'3 cm','3':'4 cm','4':'5 cm','5':'6 cm','6':'7 cm','7':'8 cm','8':'Outro tamanho'};
      const val = tamanhos[txt] || (txt.match(/\d/) ? txt : null);
      if (!val) { await perguntarAdesivoTamanho(numero); break; }
      if (val === 'Outro tamanho' || txt === '8') {
        s.dados.tamanho = 'Outro';
        s.historico.push('ADESIVO_TAMANHO');
        s.etapa = 'ADESIVO_OUTRO_TAMANHO';
        await perguntarAdesivoOutroTamanho(numero);
      } else {
        s.dados.tamanho = val;
        s.historico.push('ADESIVO_TAMANHO');
        s.etapa = 'ADESIVO_FORMATO';
        await perguntarAdesivoFormato(numero);
      }
      break;
    }

    // ── ADESIVOS — OUTRO TAMANHO ──
    case 'ADESIVO_OUTRO_TAMANHO': {
      s.dados.tamanho = txt;
      s.historico.push('ADESIVO_OUTRO_TAMANHO');
      s.etapa = 'ARTE_PERGUNTA';
      await perguntarArte(numero);
      break;
    }

    // ── ADESIVOS — FORMATO ──
    case 'ADESIVO_FORMATO': {
      const formatos = {'1':'Redondo','2':'Quadrado','redondo':'Redondo','quadrado':'Quadrado'};
      const val = formatos[txt.toLowerCase()] || null;
      if (!val) { await perguntarAdesivoFormato(numero); break; }
      s.dados.formato = val;
      s.historico.push('ADESIVO_FORMATO');
      s.etapa = 'ADESIVO_LAMINACAO';
      await perguntarAdesivoLaminacao(numero);
      break;
    }

    // ── ADESIVOS — LAMINAÇÃO ──
    case 'ADESIVO_LAMINACAO': {
      const ops = {'1':'Sim','2':'Não','sim':'Sim','não':'Não','nao':'Não','s':'Sim','n':'Não'};
      const val = ops[txt.toLowerCase()] || null;
      if (!val) { await perguntarAdesivoLaminacao(numero); break; }
      s.dados.laminacao = val;
      s.historico.push('ADESIVO_LAMINACAO');
      s.etapa = 'ARTE_PERGUNTA';
      await perguntarArte(numero);
      break;
    }

    // ── FOTOS — ÍMÃ ──
    case 'FOTO_IMA': {
      const ops = {'1':'Com ímã','2':'Sem ímã','com ima':'Com ímã','sem ima':'Sem ímã','com ímã':'Com ímã','sem ímã':'Sem ímã'};
      const val = ops[txt.toLowerCase()] || null;
      if (!val) { await perguntarFotoIma(numero); break; }
      s.dados.ima = val;
      s.historico.push('FOTO_IMA');
      s.etapa = 'FOTO_MODELO';
      await perguntarFotoModelo(numero);
      break;
    }

    // ── FOTOS — MODELO ──
    case 'FOTO_MODELO': {
      const modelos = {
        '1':'Foto Normal A6','2':'Foto Polaroid 7x9 cm',
        '3':'Foto Mini Polaroid 3,5x4 cm','4':'Foto Tirinha 5x20 cm','5':'Outro modelo'
      };
      const val = modelos[txt] || null;
      if (!val) { await perguntarFotoModelo(numero); break; }
      if (val === 'Outro modelo') {
        s.historico.push('FOTO_MODELO');
        s.etapa = 'FOTO_OUTRO_MODELO';
        await perguntarFotoOutroModelo(numero);
      } else {
        s.dados.modelo = val;
        await mostrarValoresFoto(numero);
      }
      break;
    }

    // ── FOTOS — OUTRO MODELO ──
    case 'FOTO_OUTRO_MODELO': {
      s.dados.modelo = txt;
      s.historico.push('FOTO_OUTRO_MODELO');
      s.etapa = 'ARTE_PERGUNTA';
      await perguntarArte(numero);
      break;
    }

    // ── FOTOS — CONFIRMAÇÃO DE VALORES ──
    case 'FOTO_CONFIRMAR': {
      if (txt === '1' || /sim/i.test(txt)) {
        s.historico.push('FOTO_CONFIRMAR');
        s.etapa = 'ARTE_PERGUNTA';
        await perguntarArte(numero);
      } else {
        resetarSessao(numero);
        await mostrarMenu(numero);
      }
      break;
    }

    // ── ENCADERNAÇÃO — PRODUTO ──
    case 'ENCAD_PRODUTO': {
      const prods = {'1':'Caderno A5','2':'Agenda A5','3':'Caderneta de Vacinação A5','4':'Kit Bebê','5':'Outro'};
      const val = prods[txt] || null;
      if (!val) { await perguntarEncadProduto(numero); break; }
      s.dados.produto = val;
      s.historico.push('ENCAD_PRODUTO');
      if (val === 'Caderno A5')                  { s.etapa = 'ENCAD_CADERNO_MIOLO'; await perguntarCadernoMiolo(numero); }
      else if (val === 'Agenda A5')              { s.etapa = 'ENCAD_AGENDA_MODELO'; await perguntarAgendaModelo(numero); }
      else if (val === 'Caderneta de Vacinação A5') { s.etapa = 'ENCAD_VACINA_TIPO'; await perguntarVacinaTipo(numero); }
      else if (val === 'Kit Bebê')               { s.etapa = 'ENCAD_KIT_TEMA'; await perguntarTema(numero, 'Kit Bebê'); }
      else                                       { s.etapa = 'ENCAD_OUTRO'; await perguntarEncadOutro(numero); }
      break;
    }

    // ── CADERNO — MIOLO ──
    case 'ENCAD_CADERNO_MIOLO': {
      const ops = {'1':'Pautado','2':'Pontilhado','3':'Sem pauta','pautado':'Pautado','pontilhado':'Pontilhado','sem pauta':'Sem pauta'};
      const val = ops[txt.toLowerCase()] || null;
      if (!val) { await perguntarCadernoMiolo(numero); break; }
      s.dados.miolo = val;
      s.historico.push('ENCAD_CADERNO_MIOLO');
      s.etapa = 'ENCAD_CADERNO_TEMA';
      await perguntarTema(numero, 'Caderno A5');
      break;
    }

    // ── AGENDA — MODELO ──
    case 'ENCAD_AGENDA_MODELO': {
      const ops = {'1':'Dois dias por página','2':'Um dia por página'};
      const val = ops[txt] || null;
      if (!val) { await perguntarAgendaModelo(numero); break; }
      s.dados.modeloAgenda = val;
      s.historico.push('ENCAD_AGENDA_MODELO');
      s.etapa = 'ENCAD_AGENDA_TIPO';
      await perguntarAgendaTipo(numero);
      break;
    }

    // ── AGENDA — TIPO ──
    case 'ENCAD_AGENDA_TIPO': {
      const ops = {'1':'Datada','2':'Permanente','datada':'Datada','permanente':'Permanente'};
      const val = ops[txt.toLowerCase()] || null;
      if (!val) { await perguntarAgendaTipo(numero); break; }
      s.dados.tipoAgenda = val;
      s.historico.push('ENCAD_AGENDA_TIPO');
      s.etapa = 'ENCAD_AGENDA_TEMA';
      await perguntarTema(numero, 'Agenda A5');
      break;
    }

    // ── VACINAÇÃO — TIPO ──
    case 'ENCAD_VACINA_TIPO': {
      const ops = {'1':'Restauração','2':'Nova','restauração':'Restauração','nova':'Nova','restauracao':'Restauração'};
      const val = ops[txt.toLowerCase()] || null;
      if (!val) { await perguntarVacinaTipo(numero); break; }
      s.dados.tipoVacina = val;
      s.historico.push('ENCAD_VACINA_TIPO');
      s.etapa = 'ENCAD_VACINA_TEMA';
      await perguntarTema(numero, 'Caderneta de Vacinação');
      break;
    }

    // ── TEMAS ──
    case 'ENCAD_CADERNO_TEMA':
    case 'ENCAD_AGENDA_TEMA':
    case 'ENCAD_VACINA_TEMA':
    case 'ENCAD_KIT_TEMA': {
      s.dados.tema = txt;
      s.historico.push(s.etapa);
      s.etapa = 'ARTE_PERGUNTA';
      await perguntarArte(numero);
      break;
    }

    // ── ENCAD OUTRO ──
    case 'ENCAD_OUTRO': {
      s.dados.descricao = txt;
      s.historico.push('ENCAD_OUTRO');
      s.etapa = 'ARTE_PERGUNTA';
      await perguntarArte(numero);
      break;
    }

    // ── OUTRO ──
    case 'OUTRO_DESC': {
      s.dados.descricao = txt;
      s.historico.push('OUTRO_DESC');
      s.etapa = 'ARTE_PERGUNTA';
      await perguntarArte(numero);
      break;
    }

    // ── ARTE ──
    case 'ARTE_PERGUNTA': {
      const ops = {'1':'Sim','2':'Não','sim':'Sim','não':'Não','nao':'Não','s':'Sim','n':'Não'};
      const val = ops[txt.toLowerCase()] || null;
      if (!val) { await perguntarArte(numero); break; }
      if (val === 'Sim') {
        s.dados.arte = 'Arte própria ✅';
      } else {
        s.dados.arte = 'Criação de arte (+R$ 10,00) 🎨';
        await enviar(numero, `ℹ️ A criação de arte tem um custo adicional de *R$ 10,00*.\n\nJá anotamos no seu pedido! 😊`);
      }
      s.historico.push('ARTE_PERGUNTA');
      s.etapa = 'NOVA_PECA_PERGUNTA';
      await perguntarNovaPeca(numero);
      break;
    }

    // ── NOVA PEÇA ──
    case 'NOVA_PECA_PERGUNTA': {
      const ops = {'1':'Sim','2':'Não','sim':'Sim','não':'Não','nao':'Não','s':'Sim','n':'Não'};
      const val = ops[txt.toLowerCase()] || null;
      if (!val) { await perguntarNovaPeca(numero); break; }
      if (val === 'Sim') {
        s.historico.push('NOVA_PECA_PERGUNTA');
        s.etapa = 'NOVA_PECA_DESC';
        await perguntarNovaPecaDesc(numero);
      } else {
        s.historico.push('NOVA_PECA_PERGUNTA');
        s.etapa = 'COLETAR_NOME';
        await perguntarNome(numero);
      }
      break;
    }

    // ── NOVA PEÇA DESCRIÇÃO ──
    case 'NOVA_PECA_DESC': {
      s.dados.itensAdicionais = txt;
      s.historico.push('NOVA_PECA_DESC');
      s.etapa = 'COLETAR_NOME';
      await perguntarNome(numero);
      break;
    }

    // ── COLETAR NOME ──
    case 'COLETAR_NOME': {
      s.dados.nome = txt;
      s.historico.push('COLETAR_NOME');
      s.etapa = 'COLETAR_CONTATO';
      await perguntarContato(numero);
      break;
    }

    // ── COLETAR CONTATO ──
    case 'COLETAR_CONTATO': {
      s.dados.contato = txt;
      await confirmarPedido(numero);
      break;
    }

    default:
      await mostrarMenu(numero);
  }
}

// ── PERGUNTAS ──────────────────────────────────────────────

async function perguntarAdesivoTamanho(numero) {
  const s = getSessao(numero);
  await enviar(numero,
`📐 Qual *tamanho* você deseja para ${s.dados.categoria}?

*1* — 2 cm
*2* — 3 cm
*3* — 4 cm
*4* — 5 cm
*5* — 6 cm
*6* — 7 cm
*7* — 8 cm
*8* — Outro tamanho

_Digite o número ou o tamanho. Digite *voltar* para retornar._`);
}

async function perguntarAdesivoOutroTamanho(numero) {
  await enviar(numero,
`📏 Qual a *largura e altura* desejadas?

Exemplos: *5x8 cm*, *10x15 cm*, *4x12 cm*

_Digite *voltar* para retornar._`);
}

async function perguntarAdesivoFormato(numero) {
  await enviar(numero,
`⬜ Qual *formato* você deseja?

*1* — Redondo
*2* — Quadrado

_Digite *voltar* para retornar._`);
}

async function perguntarAdesivoLaminacao(numero) {
  await enviar(numero,
`✨ Você deseja *laminação*?

*1* — Sim
*2* — Não

_Digite *voltar* para retornar._`);
}

async function perguntarFotoIma(numero) {
  await enviar(numero,
`🧲 Você deseja as fotos *com ímã ou sem ímã*?

*1* — Com ímã
*2* — Sem ímã

_Digite *voltar* para retornar._`);
}

async function perguntarFotoModelo(numero) {
  await enviar(numero,
`📸 Qual *modelo de foto* você deseja?

*1* — Foto Normal A6
*2* — Foto Polaroid 7x9 cm
*3* — Foto Mini Polaroid 3,5x4 cm
*4* — Foto Tirinha 5x20 cm
*5* — Outro modelo

_Digite *voltar* para retornar._`);
}

async function perguntarFotoOutroModelo(numero) {
  await enviar(numero,
`📝 Descreva o *modelo de foto* desejado ou informe as medidas.

Exemplos: *10x15 cm*, *Foto quadrada*, *Foto estilo polaroid personalizada*

_Digite *voltar* para retornar._`);
}

async function mostrarValoresFoto(numero) {
  const s = getSessao(numero);
  const modelo = s.dados.modelo;
  const ima = s.dados.ima;
  let tabela = '';

  if (modelo === 'Foto Normal A6') {
    tabela = `• Kit com 4 fotos — valor sob consulta`;
  } else if (modelo === 'Foto Polaroid 7x9 cm') {
    if (ima === 'Sem ímã') tabela = `• Unidade: *R$ 3,50*\n• Kit com 8 fotos: *R$ 25,00*`;
    else                   tabela = `• Unidade: *R$ 4,50*\n• Kit com 8 fotos: *R$ 30,00*`;
  } else if (modelo === 'Foto Mini Polaroid 3,5x4 cm') {
    if (ima === 'Sem ímã') tabela = `• Kit com 35 fotos: *R$ 25,00*`;
    else                   tabela = `• Kit com 35 fotos: *R$ 30,00*`;
  } else if (modelo === 'Foto Tirinha 5x20 cm') {
    if (ima === 'Sem ímã') tabela = `• Kit com 5 fotos: *R$ 25,00*`;
    else                   tabela = `• Kit com 5 fotos: *R$ 30,00*`;
  } else {
    tabela = `• Valor sob consulta`;
  }

  await enviar(numero,
`💰 *Valores — ${modelo} (${ima})*

${tabela}

Deseja prosseguir com o pedido?

*1* — Sim, quero encomendar!
*2* — Não, voltar ao menu`);

  s.etapa = 'FOTO_CONFIRMAR';
}

async function perguntarEncadProduto(numero) {
  await enviar(numero,
`📚 Qual *produto de encadernação* você deseja?

*1* — Caderno A5
*2* — Agenda A5
*3* — Caderneta de Vacinação A5
*4* — Kit Bebê (Caderneta + Livro do Bebê)
*5* — Outro

_Digite *voltar* para retornar ao menu._`);
}

async function perguntarCadernoMiolo(numero) {
  await enviar(numero,
`📄 Qual tipo de *miolo* você deseja?

*1* — Pautado
*2* — Pontilhado
*3* — Sem pauta

_Digite *voltar* para retornar._`);
}

async function perguntarAgendaModelo(numero) {
  await enviar(numero,
`📅 Qual *modelo de agenda* você deseja?

*1* — Dois dias por página
*2* — Um dia por página

_Digite *voltar* para retornar._`);
}

async function perguntarAgendaTipo(numero) {
  await enviar(numero,
`🗓️ A agenda será *datada ou permanente*?

*1* — Datada
*2* — Permanente

_Digite *voltar* para retornar._`);
}

async function perguntarVacinaTipo(numero) {
  await enviar(numero,
`💉 Você deseja *restauração* ou uma *caderneta nova*?

*1* — Restauração
*2* — Nova

_Digite *voltar* para retornar._`);
}

async function perguntarTema(numero, produto) {
  await enviar(numero,
`🎨 Qual é o *tema ou personalização* desejada para o(a) *${produto}*?

Descreva livremente! Ex: *floral*, *minimalista*, *nome do bebê*, *unicórnio*...

_Digite *voltar* para retornar._`);
}

async function perguntarEncadOutro(numero) {
  await enviar(numero,
`📝 Qual *produto de encadernação* você deseja?

Descreva livremente.

_Digite *voltar* para retornar._`);
}

async function perguntarOutroDesc(numero) {
  await enviar(numero,
`💬 Por favor, descreva o *produto ou serviço* que você procura:

_Digite *voltar* para retornar ao menu._`);
}

async function perguntarArte(numero) {
  await enviar(numero,
`🖼️ Você tem *arte pronta* para o pedido?

*1* — Sim, tenho arte pronta
*2* — Não, preciso criar

_A criação de arte tem custo adicional de R$ 10,00._
_Digite *voltar* para retornar._`);
}

async function perguntarNovaPeca(numero) {
  await enviar(numero,
`➕ Deseja adicionar mais algum item ao pedido?

*1* — Sim
*2* — Não

_Digite *voltar* para retornar._`);
}

async function perguntarNovaPecaDesc(numero) {
  await enviar(numero,
`📦 Descreva o(s) item(ns) adicional(is):

Informe o *produto*, *tamanho* e *quantidade*.
Ex: _50 adesivos redondos 5cm, 10 fotos polaroid sem ímã_

_Digite *voltar* para retornar._`);
}

async function perguntarNome(numero) {
  await enviar(numero,
`Ótimo! Quase lá! 😊

Qual é o seu *nome completo*?`);
}

async function perguntarContato(numero) {
  await enviar(numero,
`Perfeito! Pode me passar um *número de contato* com DDD?

_(pode ser este mesmo ou outro)_`);
}

// ── CONFIRMAR PEDIDO FINAL ─────────────────────────────────
async function confirmarPedido(numero) {
  const s = getSessao(numero);
  const d = s.dados;

  const linhas = Object.entries(d)
    .filter(([k]) => k !== 'etapa')
    .map(([k, v]) => `• *${capitalize(k)}:* ${v}`)
    .join('\n');

  await enviar(numero,
`🎉 *Pedido registrado com sucesso!*

📋 *Resumo:*
${linhas}

A *Giselle* vai entrar em contato em breve com o orçamento! 💚

Obrigada pela preferência na *GS Studio Criativo*! 🛍️`);

  await notificarGiselle(d, numero);
  sessoes[numero] = { etapa: 'FINALIZADO', historico: [], dados: {} };
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── DEBUG ──────────────────────────────────────────────────
let ultimoPayload = null;
app.get('/debug', (req, res) => res.json({ ultimoPayload }));

// ── WEBHOOK ────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    let body = req.body;
    ultimoPayload = body;
    console.log('Webhook raw:', JSON.stringify(body).slice(0, 400));

    if (body && typeof body.data === 'string') {
      try {
        body = { ...body, data: JSON.parse(Buffer.from(body.data, 'base64').toString('utf8')) };
      } catch (e) {
        console.error('Erro ao decodificar base64:', e.message);
        return;
      }
    }

    const evento = (body?.event || body?.type || '').toUpperCase();
    if (!evento.includes('MESSAGE')) return;

    const msg = body?.data?.messages?.[0] || body?.data || body?.messages?.[0] || null;
    if (!msg) return;

    const remoteJid = msg.key?.remoteJid || msg.remoteJid || '';
    if (remoteJid.includes('@g.us')) return;

    const numero = remoteJid.replace('@s.whatsapp.net', '');
    const texto = msg.message?.conversation
               || msg.message?.extendedTextMessage?.text
               || msg.body || msg.text || '';

    if (!numero || !texto) return;

    // Giselle digita "pedido finalizado" → reativa o bot para aquele cliente
    if (msg.key?.fromMe) {
      if (texto.trim().toLowerCase() === 'pedido finalizado') {
        resetarSessao(numero);
        console.log('Sessão reativada para:', numero);
      }
      return;
    }

    console.log('De:', numero, '| Msg:', texto);

    const s = getSessao(numero);

    // Primeira mensagem do cliente → mostra menu automaticamente
    if (s.nova) {
      s.nova = false;
      await mostrarMenu(numero);
      return;
    }

    await processar(numero, texto);
  } catch (err) {
    console.error('Erro webhook:', err.message);
  }
});

app.get('/', (req, res) => res.json({ status: 'GS Studio Bot online ✅' }));

app.listen(CONFIG.PORT, () => {
  console.log(`🤖 GS Studio Bot rodando na porta ${CONFIG.PORT}`);
});
