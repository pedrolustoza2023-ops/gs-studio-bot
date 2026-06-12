const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const app = express();
app.use(express.json());

const CONFIG = {
  EVOLUTION_URL:  process.env.EVOLUTION_URL  || 'https://evolution-api-production-935a.up.railway.app',
  EVOLUTION_KEY:  process.env.EVOLUTION_KEY  || '',
  INSTANCE:       process.env.INSTANCE_NAME  || 'GSstudio',
  GISELLE_NUMBER: process.env.GISELLE_NUMBER || '5511931449232',
  EMAIL_USER:     process.env.EMAIL_USER     || 'criativogsstudio@gmail.com',
  EMAIL_PASS:     process.env.EMAIL_PASS     || '',
  EMAIL_TO:       'criativogsstudio@gmail.com',
  PORT:           process.env.PORT           || 3000,
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: CONFIG.EMAIL_USER, pass: CONFIG.EMAIL_PASS },
});

const sessoes = {};
function getSessao(n) { if (!sessoes[n]) sessoes[n] = { etapa: 'MENU', historico: [], dados: {} }; return sessoes[n]; }
function resetarSessao(n) { sessoes[n] = { etapa: 'MENU', historico: [], dados: {} }; }

async function enviar(numero, texto) {
  try {
    await axios.post(`${CONFIG.EVOLUTION_URL}/message/sendText/${CONFIG.INSTANCE}`,
      { number: numero, text: texto },
      { headers: { apikey: CONFIG.EVOLUTION_KEY } });
    console.log('✅ Enviado para', numero);
  } catch (e) { console.error('❌ Erro envio:', e.message); }
}

async function notificarGiselle(dados, numero) {
  const linhas = Object.entries(dados).map(([k,v]) => `${k}: ${v}`).join('\n');
  await enviar(CONFIG.GISELLE_NUMBER,
`🔔 *Novo pedido — GS Studio Criativo*\n\n${linhas}\n\n📱 Cliente: wa.me/${numero}\n_Pronto para fechar!_`);
  if (CONFIG.EMAIL_PASS) {
    try {
      await transporter.sendMail({
        from: `"GS Studio Bot" <${CONFIG.EMAIL_USER}>`,
        to: CONFIG.EMAIL_TO,
        subject: '🔔 Novo pedido GS Studio',
        html: `<pre>${JSON.stringify({...dados, numero}, null, 2)}</pre>`
      });
    } catch(e) { console.error('Email erro:', e.message); }
  }
}

async function mostrarMenu(numero) {
  getSessao(numero).etapa = 'MENU';
  await enviar(numero,
`Olá! 👋 Bem-vindo(a) à *GS Studio Criativo*!

Sou a assistente virtual da Giselle. 😊

O que você procura?

*1* — Adesivos
*2* — Tags
*3* — Fotos
*4* — Encadernação
*5* — Outro`);
}

async function processar(numero, texto) {
  const s = getSessao(numero);
  const txt = texto.trim();
  const low = txt.toLowerCase();

  if (['oi','olá','ola','bom dia','boa tarde','boa noite','menu','inicio','início'].includes(low)) {
    resetarSessao(numero); await mostrarMenu(numero); return;
  }
  if (low === 'voltar' || txt === '0') {
    if (s.historico.length > 0) s.etapa = s.historico.pop();
    else s.etapa = 'MENU';
    await despachar(numero); return;
  }
  await handleEtapa(numero, txt);
}

async function despachar(numero) {
  const s = getSessao(numero);
  const map = {
    'MENU': mostrarMenu,
    'TAMANHO': () => enviar(numero, `Qual *tamanho*?\n\n*1*-2cm *2*-3cm *3*-4cm *4*-5cm *5*-6cm *6*-7cm *7*-8cm *8*-Outro\n\n_voltar = voltar_`),
    'FORMATO': () => enviar(numero, `Qual *formato*?\n\n*1* — Redondo\n*2* — Quadrado\n\n_voltar = voltar_`),
    'LAMINACAO': () => enviar(numero, `Deseja *laminação*?\n\n*1* — Sim\n*2* — Não\n\n_voltar = voltar_`),
    'FOTO_IMA': () => enviar(numero, `Com *ímã ou sem ímã*?\n\n*1* — Com ímã\n*2* — Sem ímã\n\n_voltar = voltar_`),
    'FOTO_MODELO': () => enviar(numero, `Qual *modelo*?\n\n*1*-Normal A6\n*2*-Polaroid 7x9\n*3*-Mini Polaroid 3,5x4\n*4*-Tirinha 5x20\n*5*-Outro\n\n_voltar = voltar_`),
  };
  if (map[s.etapa]) await map[s.etapa]();
  else await mostrarMenu(numero);
}

async function handleEtapa(numero, txt) {
  const s = getSessao(numero);

  switch(s.etapa) {
    case 'MENU': {
      if (txt==='1'||/adesivo/i.test(txt)) { s.dados.categoria='Adesivos'; s.historico.push('MENU'); s.etapa='TAMANHO'; await enviar(numero,`Qual *tamanho* para os Adesivos?\n\n*1*-2cm *2*-3cm *3*-4cm *4*-5cm *5*-6cm *6*-7cm *7*-8cm *8*-Outro tamanho\n\n_voltar = voltar_`); }
      else if (txt==='2'||/tag/i.test(txt)) { s.dados.categoria='Tags'; s.historico.push('MENU'); s.etapa='TAMANHO'; await enviar(numero,`Qual *tamanho* para as Tags?\n\n*1*-2cm *2*-3cm *3*-4cm *4*-5cm *5*-6cm *6*-7cm *7*-8cm *8*-Outro tamanho\n\n_voltar = voltar_`); }
      else if (txt==='3'||/foto/i.test(txt)) { s.dados.categoria='Fotos'; s.historico.push('MENU'); s.etapa='FOTO_IMA'; await enviar(numero,`🧲 Com *ímã ou sem ímã*?\n\n*1* — Com ímã\n*2* — Sem ímã\n\n_voltar = voltar_`); }
      else if (txt==='4'||/encad/i.test(txt)) { s.dados.categoria='Encadernação'; s.historico.push('MENU'); s.etapa='ENCAD'; await enviar(numero,`📚 Qual *produto*?\n\n*1*-Caderno A5\n*2*-Agenda A5\n*3*-Caderneta Vacinação\n*4*-Kit Bebê\n*5*-Outro\n\n_voltar = voltar_`); }
      else if (txt==='5'||/outro/i.test(txt)) { s.dados.categoria='Outro'; s.historico.push('MENU'); s.etapa='OUTRO'; await enviar(numero,`Descreva o produto ou serviço que procura:\n\n_voltar = voltar_`); }
      else await enviar(numero,'Digite o número da opção (1 a 5) 😊');
      break;
    }
    case 'TAMANHO': {
      const t={'1':'2cm','2':'3cm','3':'4cm','4':'5cm','5':'6cm','6':'7cm','7':'8cm','8':'Outro'};
      const val = t[txt] || txt;
      s.dados.tamanho = val; s.historico.push('TAMANHO');
      if (val==='Outro') { s.etapa='TAMANHO_OUTRO'; await enviar(numero,`Informe largura e altura:\nEx: *5x8cm*, *10x15cm*\n\n_voltar = voltar_`); }
      else { s.etapa='FORMATO'; await enviar(numero,`Qual *formato*?\n\n*1* — Redondo\n*2* — Quadrado\n\n_voltar = voltar_`); }
      break;
    }
    case 'TAMANHO_OUTRO': { s.dados.tamanho=txt; await coletarNome(numero); break; }
    case 'FORMATO': {
      const f={'1':'Redondo','2':'Quadrado','redondo':'Redondo','quadrado':'Quadrado'};
      s.dados.formato = f[txt.toLowerCase()]||txt; s.historico.push('FORMATO'); s.etapa='LAMINACAO';
      await enviar(numero,`Deseja *laminação*?\n\n*1* — Sim\n*2* — Não\n\n_voltar = voltar_`);
      break;
    }
    case 'LAMINACAO': {
      s.dados.laminacao = (txt==='1'||/sim/i.test(txt))?'Sim':'Não';
      await coletarNome(numero); break;
    }
    case 'FOTO_IMA': {
      s.dados.ima = (txt==='1'||/com/i.test(txt))?'Com ímã':'Sem ímã';
      s.historico.push('FOTO_IMA'); s.etapa='FOTO_MODELO';
      await enviar(numero,`📸 Qual *modelo de foto*?\n\n*1*-Normal A6\n*2*-Polaroid 7x9cm\n*3*-Mini Polaroid 3,5x4cm\n*4*-Tirinha 5x20cm\n*5*-Outro\n\n_voltar = voltar_`);
      break;
    }
    case 'FOTO_MODELO': {
      const m={'1':'Normal A6','2':'Polaroid 7x9cm','3':'Mini Polaroid 3,5x4cm','4':'Tirinha 5x20cm','5':'Outro'};
      const val = m[txt]||txt; s.dados.modelo=val;
      if (val==='Outro') { s.historico.push('FOTO_MODELO'); s.etapa='FOTO_OUTRO'; await enviar(numero,`Descreva o modelo ou informe as medidas:\n\n_voltar = voltar_`); }
      else {
        const ima=s.dados.ima; let v='• Preço sob consulta';
        if(val==='Polaroid 7x9cm') v=ima==='Com ímã'?'• Unidade: R$4,50\n• Kit 8: R$30,00':'• Unidade: R$3,50\n• Kit 8: R$25,00';
        else if(val==='Mini Polaroid 3,5x4cm') v=ima==='Com ímã'?'• Kit 35: R$30,00':'• Kit 35: R$25,00';
        else if(val==='Tirinha 5x20cm') v=ima==='Com ímã'?'• Kit 5: R$30,00':'• Kit 5: R$25,00';
        s.etapa='FOTO_CONFIRMAR';
        await enviar(numero,`💰 *${val} — ${ima}*\n\n${v}\n\nDeseja encomendar?\n*1* — Sim!\n*2* — Voltar ao menu`);
      }
      break;
    }
    case 'FOTO_OUTRO': { s.dados.modelo=txt; await coletarNome(numero); break; }
    case 'FOTO_CONFIRMAR': {
      if(txt==='1'||/sim/i.test(txt)) await coletarNome(numero);
      else { resetarSessao(numero); await mostrarMenu(numero); }
      break;
    }
    case 'ENCAD': {
      const p={'1':'Caderno A5','2':'Agenda A5','3':'Caderneta Vacinação','4':'Kit Bebê','5':'Outro'};
      s.dados.produto=p[txt]||txt; s.historico.push('ENCAD');
      if(txt==='1'){s.etapa='CADERNO_MIOLO';await enviar(numero,`Tipo de *miolo*?\n\n*1*-Pautado\n*2*-Pontilhado\n*3*-Sem pauta\n\n_voltar = voltar_`);}
      else if(txt==='2'){s.etapa='AGENDA_MODELO';await enviar(numero,`Modelo da *agenda*?\n\n*1*-Dois dias/página\n*2*-Um dia/página\n\n_voltar = voltar_`);}
      else if(txt==='3'){s.etapa='VACINA_TIPO';await enviar(numero,`*Restauração* ou *nova*?\n\n*1*-Restauração\n*2*-Nova\n\n_voltar = voltar_`);}
      else if(txt==='4'){s.etapa='TEMA';await enviar(numero,`Qual o *tema* para o Kit Bebê?\n\n_voltar = voltar_`);}
      else{s.etapa='ENCAD_OUTRO';await enviar(numero,`Descreva o produto desejado:\n\n_voltar = voltar_`);}
      break;
    }
    case 'CADERNO_MIOLO': { const m={'1':'Pautado','2':'Pontilhado','3':'Sem pauta'}; s.dados.miolo=m[txt]||txt; s.historico.push('CADERNO_MIOLO'); s.etapa='TEMA'; await enviar(numero,`Qual o *tema* para o Caderno A5?\n\n_voltar = voltar_`); break; }
    case 'AGENDA_MODELO': { s.dados.modeloAgenda=txt==='1'?'Dois dias/página':'Um dia/página'; s.historico.push('AGENDA_MODELO'); s.etapa='AGENDA_TIPO'; await enviar(numero,`*Datada ou permanente*?\n\n*1*-Datada\n*2*-Permanente\n\n_voltar = voltar_`); break; }
    case 'AGENDA_TIPO': { s.dados.tipoAgenda=txt==='1'?'Datada':'Permanente'; s.historico.push('AGENDA_TIPO'); s.etapa='TEMA'; await enviar(numero,`Qual o *tema* para a Agenda?\n\n_voltar = voltar_`); break; }
    case 'VACINA_TIPO': { s.dados.tipoVacina=txt==='1'?'Restauração':'Nova'; s.historico.push('VACINA_TIPO'); s.etapa='TEMA'; await enviar(numero,`Qual o *tema* para a Caderneta?\n\n_voltar = voltar_`); break; }
    case 'TEMA': { s.dados.tema=txt; await coletarNome(numero); break; }
    case 'ENCAD_OUTRO': { s.dados.descricao=txt; await coletarNome(numero); break; }
    case 'OUTRO': { s.dados.descricao=txt; await coletarNome(numero); break; }
    case 'NOME': { s.dados.nome=txt; s.etapa='CONTATO'; await enviar(numero,`Pode passar um *número de contato* com DDD?\n_(pode ser este mesmo)_`); break; }
    case 'CONTATO': { s.dados.contato=txt; await confirmar(numero); break; }
    default: await mostrarMenu(numero);
  }
}

async function coletarNome(numero) {
  const s = getSessao(numero);
  s.etapa='NOME';
  await enviar(numero,`✅ Anotei! Qual é o seu *nome completo*?`);
}

async function confirmar(numero) {
  const s = getSessao(numero);
  const d = s.dados;
  const linhas = Object.entries(d).map(([k,v])=>`• *${k}:* ${v}`).join('\n');
  await enviar(numero,`🎉 *Pedido registrado!*\n\n${linhas}\n\nA *Giselle* entrará em contato com o orçamento! 💚\nObrigada pela preferência! 🛍️`);
  await notificarGiselle(d, numero);
  resetarSessao(numero);
}

// ── WEBHOOK ────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    console.log('📨 Webhook recebido. Event:', body?.event, 'Keys:', Object.keys(body||{}).join(','));

    // Extrai número e texto de QUALQUER formato da Evolution API
    let numero = null, texto = null;

    // Formato 1: messages.upsert
    const msg = body?.data?.messages?.[0] || (Array.isArray(body?.data) ? null : body?.data);
    if (msg?.key?.remoteJid) {
      if (msg.key.fromMe) return;
      if (msg.key.remoteJid.includes('@g.us')) return;
      numero = msg.key.remoteJid.replace('@s.whatsapp.net','').replace('@lid','');
      texto = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.text || '';
    }

    // Formato 2: campo direto no body
    if (!numero && body?.remoteJid) {
      numero = body.remoteJid.replace('@s.whatsapp.net','');
      texto = body.text || body.body || '';
    }

    console.log('📱 Número:', numero, '| Texto:', texto);
    if (!numero || !texto) { console.log('⚠️ Sem número ou texto, ignorando'); return; }

    await processar(numero, texto);
  } catch(e) { console.error('❌ Erro webhook:', e.message); }
});

app.get('/', (req, res) => res.json({ status: 'GS Studio Bot online ✅' }));
app.listen(CONFIG.PORT, () => console.log(`🤖 GS Studio Bot porta ${CONFIG.PORT}`));
