const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const Database = require('better-sqlite3');
const express = require('express');

const db = new Database('abismo.db');
db.exec(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, xp INTEGER DEFAULT 0, nivel INTEGER DEFAULT 1, moedas INTEGER DEFAULT 100, vitorias INTEGER DEFAULT 0, derrotas INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS estoque (item TEXT PRIMARY KEY, qtd INTEGER, ultimo_reset INTEGER);
CREATE TABLE IF NOT EXISTS inventarios (userId TEXT, item TEXT, tipo TEXT, qtd INTEGER DEFAULT 1, PRIMARY KEY(userId, item));
CREATE TABLE IF NOT EXISTS tesouro (total INTEGER DEFAULT 0);
INSERT OR IGNORE INTO tesouro VALUES (0);
`);

const ARMAS = [
  { id: 'espada_gelo', nome: '❄️ Espada de Gelo', preco: 100, nivelMin: 1, dano: 10 },
  { id: 'machado_polar', nome: '🪓 Machado Polar', preco: 250, nivelMin: 3, dano: 25 },
  { id: 'arco_ventania', nome: '🏹 Arco da Ventania', preco: 500, nivelMin: 5, dano: 45 },
  { id: 'lanca_eterna', nome: '🔱 Lança Eterna', preco: 1000, nivelMin: 8, dano: 80 },
  { id: 'foice_sombria', nome: '☠️ Foice Sombria', preco: 2000, nivelMin: 10, dano: 150 }
];

const BESTAS = {
  'lobo_neve': { nome: '🐺 Lobo da Neve', nivel: 1, vida: 50, chance: 0.6, drop: { id: 'presa_lobo', nome: '🦷 Presa de Lobo', chance: 0.8 } },
  'urso_polar': { nome: '🐻‍❄️ Urso Polar', nivel: 3, vida: 120, chance: 0.4, drop: { id: 'garra_urso', nome: '🐾 Garra de Urso Polar', chance: 0.7 } },
  'tigre_gelo': { nome: '🐯 Tigre de Gelo', nivel: 5, vida: 250, chance: 0.25, drop: { id: 'pele_tigre', nome: '❄️ Pele de Tigre de Gelo', chance: 0.6 } },
  'dragao_gelo': { nome: '🐉 Dragão de Gelo', nivel: 8, vida: 500, chance: 0.05, drop: { id: 'escama_dragao', nome: '💎 Escama de Dragão Lendária', chance: 0.4 } },
  'kraken': { nome: '🦑 KRAKEN DO ABISMO', nivel: 10, vida: 800, chance: 0.02, drop: { id: 'braco_kraken', nome: '🦑 Braço do Kraken', chance: 0.5 } },
  'leviatan': { nome: '🌊 Leviatã', nivel: 12, vida: 1200, chance: 0.01, drop: { id: 'olho_leviatan', nome: '👁️ Olho do Leviatã', chance: 0.3 } }
};

const RECEITAS = {
  'chicote_kraken': { nome: '🔱 Chicote do Abismo', dano: 200, precisa: [{ id: 'braco_kraken', qtd: 3 }], desc: '3x Braço do Kraken' },
  'armadura_dragao': { nome: '🛡️ Armadura de Escamas', dano: 0, defesa: 100, precisa: [{ id: 'escama_dragao', qtd: 5 }], desc: '5x Escama de Dragão' },
  'anel_leviatan': { nome: '💍 Anel do Leviatã', dano: 350, precisa: [{ id: 'olho_leviatan', qtd: 1 }, { id: 'braco_kraken', qtd: 2 }, { id: 'escama_dragao', qtd: 2 }], desc: '1 Olho + 2 Braços + 2 Escamas' },
  'adaga_lobo': { nome: '🗡️ Adaga de Presa', dano: 30, precisa: [{ id: 'presa_lobo', qtd: 4 }], desc: '4x Presa de Lobo' }
};

function addItem(userId, itemId, tipo, qtd=1) {
  const existe = db.prepare('SELECT qtd FROM inventarios WHERE userId=? AND item=?').get(userId, itemId);
  if (existe) db.prepare('UPDATE inventarios SET qtd=qtd+? WHERE userId=? AND item=?').run(qtd, userId, itemId);
  else db.prepare('INSERT INTO inventarios (userId, item, tipo, qtd) VALUES (?,?,?,?)').run(userId, itemId, tipo, qtd);
}

function getLojaDeHoje() {
  const agora = Date.now();
  const ultimo = db.prepare('SELECT * FROM estoque WHERE item="reset"').get();
  if (!ultimo || (agora - ultimo.ultimo_reset) > 86400000) {
    const sorteadas = ARMAS.sort(() => 0.5 - Math.random()).slice(0,3);
    db.exec('DELETE FROM estoque');
    for (const arma of sorteadas) db.prepare('INSERT INTO estoque (item, qtd, ultimo_reset) VALUES (?,?,?)').run(arma.id, 5, agora);
    db.prepare('INSERT INTO estoque (item, qtd, ultimo_reset) VALUES (?,?,?)').run('reset', 0, agora);
    return sorteadas;
  }
  const rows = db.prepare('SELECT * FROM estoque WHERE item!="reset"').all();
  return rows.map(r => ARMAS.find(a => a.id === r.item)).filter(Boolean);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();
  const userId = interaction.user.id;
  let user = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  if (!user) { db.prepare('INSERT INTO users (id) VALUES (?)').run(userId); user = db.prepare('SELECT * FROM users WHERE id=?').get(userId); }

  if (interaction.commandName === 'comecar') return interaction.editReply(`🏔️ Bem-vindo a Palquia, ${interaction.user.username}! Nível ${user.nivel} | ${user.moedas} moedas`);
  if (interaction.commandName === 'loja') {
    const loja = getLojaDeHoje();
    let desc = loja.map(a => { const est = db.prepare('SELECT qtd FROM estoque WHERE item=?').get(a.id); return `${a.nome} - ${a.preco}m | Estoque: ${est?.qtd || 0} | Nvl ${a.nivelMin}+`; }).join('\n');
    return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🏪 Loja - Estoque 24h').setDescription(desc).setColor(0x00BFFF)] });
  }
  if (interaction.commandName === 'comprar') {
    const nome = interaction.options.getString('item').toLowerCase();
    const arma = ARMAS.find(a => a.id.includes(nome) || a.nome.toLowerCase().includes(nome));
    if (!arma) return interaction.editReply('❌ Não achei');
    const estoque = db.prepare('SELECT qtd FROM estoque WHERE item=?').get(arma.id);
    if (!estoque || estoque.qtd <= 0) return interaction.editReply('❌ Sem estoque!');
    if (user.moedas < arma.preco) return interaction.editReply(`❌ Precisa de ${arma.preco}`);
    if (user.nivel < arma.nivelMin) return interaction.editReply(`❌ Nível ${arma.nivelMin} necessário`);
    db.prepare('UPDATE users SET moedas=moedas-? WHERE id=?').run(arma.preco, userId);
    db.prepare('UPDATE estoque SET qtd=qtd-1 WHERE item=?').run(arma.id);
    addItem(userId, arma.id, 'arma', 1);
    db.prepare('UPDATE tesouro SET total=total+?').run(Math.floor(arma.preco*0.1));
    return interaction.editReply(`✅ Comprou ${arma.nome}!`);
  }
  if (interaction.commandName === 'domar') {
    const escolha = interaction.options.getString('besta').toLowerCase();
    const besta = Object.entries(BESTAS).find(([k]) => k.includes(escolha));
    if (!besta) return interaction.editReply('❌ Besta inválida');
    const [id, data] = besta;
    if (user.nivel < data.nivel) return interaction.editReply(`❌ Precisa nível ${data.nivel}`);
    if (Math.random() < data.chance) { addItem(userId, id, 'besta', 1); return interaction.editReply(`🎉 Você domou ${data.nome}!`); }
    else return interaction.editReply(`💨 ${data.nome} fugiu! Chance ${data.chance*100}%`);
  }
  if (interaction.commandName === 'cacar') {
    const escolha = interaction.options.getString('besta').toLowerCase();
    const besta = Object.entries(BESTAS).find(([k]) => k.includes(escolha));
    if (!besta) return interaction.editReply('❌ Besta inválida');
    const [id, data] = besta;
    if (user.nivel < data.nivel) return interaction.editReply(`❌ Precisa nível ${data.nivel} pra caçar ${data.nome}`);
    const seuPoder = user.nivel*15 + user.vitorias*3 + Math.random()*30;
    if (seuPoder < data.vida/10) { db.prepare('UPDATE users SET derrotas=derrotas+1, xp=xp+5 WHERE id=?').run(userId); return interaction.editReply(`💀 Perdeu pra ${data.nome}! +5 XP`); }
    const xpGanho = data.vida/2; const moedasGanhas = data.nivel*20;
    const novoXp = user.xp + xpGanho; const novoNivel = Math.floor(novoXp/200)+1;
    db.prepare('UPDATE users SET xp=?, nivel=?, vitorias=vitorias+1, moedas=moedas+? WHERE id=?').run(novoXp, novoNivel, moedasGanhas, userId);
    if (Math.random() < data.drop.chance) {
      addItem(userId, data.drop.id, 'drop', 1);
      const total = db.prepare('SELECT qtd FROM inventarios WHERE userId=? AND item=?').get(userId, data.drop.id).qtd;
      return interaction.editReply(`⚔️ DERROTOU ${data.nome.toUpperCase()}! +${xpGanho} XP +${moedasGanhas} moedas\n🎁 DROP: ${data.drop.nome}! Você arrancou dele! x${total}`);
    } else return interaction.editReply(`⚔️ DERROTOU ${data.nome.toUpperCase()}! +${xpGanho} XP +${moedasGanhas} moedas\n😢 Sem drop (${data.drop.chance*100}%)`);
  }
  if (interaction.commandName === 'forjar') {
    const escolha = interaction.options.getString('item').toLowerCase();
    const receita = Object.entries(RECEITAS).find(([k,v]) => k.includes(escolha) || v.nome.toLowerCase().includes(escolha));
    if (!receita) { let lista = Object.values(RECEITAS).map(r => `${r.nome}: ${r.desc}`).join('\n'); return interaction.editReply(`❌ Receita não existe!\n${lista}`); }
    const [id, data] = receita;
    for (const mat of data.precisa) { const tem = db.prepare('SELECT qtd FROM inventarios WHERE userId=? AND item=?').get(userId, mat.id); if (!tem || tem.qtd < mat.qtd) return interaction.editReply(`❌ Falta ${mat.qtd}x ${mat.id}, você tem ${tem?.qtd || 0}`); }
    for (const mat of data.precisa) db.prepare('UPDATE inventarios SET qtd=qtd-? WHERE userId=? AND item=?').run(mat.qtd, userId, mat.id);
    db.prepare('DELETE FROM inventarios WHERE qtd<=0'); addItem(userId, id, 'arma_lendaria', 1);
    return interaction.editReply(`🔥 FORJOU ${data.nome.toUpperCase()}! Dano: ${data.dano || 0}`);
  }
  if (interaction.commandName === 'perfil') {
    const inv = db.prepare('SELECT * FROM inventarios WHERE userId=?').all(userId);
    return interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`👑 ${interaction.user.username} - Nvl ${user.nivel}`).setDescription(`XP: ${user.xp}/${user.nivel*200}\nMoedas: ${user.moedas}\nV/D: ${user.vitorias}/${user.derrotas}\nItens: ${inv.length}`).setColor(0xFFFFFF)] });
  }
  if (interaction.commandName === 'inventario') {
    const inv = db.prepare('SELECT * FROM inventarios WHERE userId=?').all(userId);
    if (!inv.length) return interaction.editReply('🎒 Vazio');
    let txt = '🎒 Inventário:\n'; for (const i of inv) txt += `- ${i.item} x${i.qtd} (${i.tipo})\n`;
    return interaction.editReply(txt);
  }
  if (interaction.commandName === 'arena') {
    const op = interaction.options.getUser('oponente'); if (op.id === userId) return interaction.editReply('❌ Não pode se auto-duelar');
    let opp = db.prepare('SELECT * FROM users WHERE id=?').get(op.id); if (!opp) return interaction.editReply('❌ Ele precisa usar /comecar');
    const seuPoder = user.nivel*10 + user.vitorias*2 + Math.random()*20; const delePoder = opp.nivel*10 + opp.vitorias*2 + Math.random()*20;
    if (seuPoder > delePoder) { const xp = 50+opp.nivel*5; const novoXp = user.xp+xp; const novoNvl = Math.floor(novoXp/200)+1; db.prepare('UPDATE users SET xp=?, nivel=?, vitorias=vitorias+1, moedas=moedas+15 WHERE id=?').run(novoXp, novoNvl, userId); db.prepare('UPDATE users SET derrotas=derrotas+1 WHERE id=?').run(op.id); return interaction.editReply(`⚔️ VENCEU ${op}! +${xp} XP`); }
    else { db.prepare('UPDATE users SET derrotas=derrotas+1, xp=xp+10 WHERE id=?').run(userId); db.prepare('UPDATE users SET vitorias=vitorias+1 WHERE id=?').run(op.id); return interaction.editReply(`😵 Perdeu pra ${op}... +10 XP`); }
  }
  if (interaction.commandName === 'ranking') {
    const top = db.prepare('SELECT * FROM users ORDER BY nivel DESC LIMIT 10').all();
    let desc = top.map((u,i)=>`${i+1}. <@${u.id}> - Nvl ${u.nivel}`).join('\n');
    return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🏆 Ranking').setDescription(desc).setColor(0xFFD700)] });
  }
  if (interaction.commandName === 'muralha') {
    const top = db.prepare('SELECT * FROM users ORDER BY vitorias DESC LIMIT 5').all();
    let desc = top.map((u,i)=>`${i+1}. <@${u.id}> - ${u.vitorias}V`).join('\n') || 'Vazio';
    return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🧱 Muralha').setDescription(desc).setColor(0x8B4513)] });
  }
  if (interaction.commandName === 'tesouro') {
    const total = db.prepare('SELECT total FROM tesouro').get().total;
    return interaction.editReply(`💰 Tesouro Real: ${total} moedas!`);
  }
});

const commands = [
  { name: 'comecar', description: 'Começar em Palquia' },
  { name: 'loja', description: 'Ver loja 24h' },
  { name: 'comprar', description: 'Comprar arma', options: [{ name:'item', type:3, description:'nome', required:true }] },
  { name: 'domar', description: 'Domar besta', options: [{ name:'besta', type:3, description:'besta', required:true }] },
  { name: 'cacar', description: 'Caçar besta e pegar drop tipo Braço do Kraken', options: [{ name:'besta', type:3, description:'kraken, leviatan...', required:true }] },
  { name: 'forjar', description: 'Forjar arma lendária', options: [{ name:'item', type:3, description:'chicote_kraken etc', required:true }] },
  { name: 'perfil', description: 'Ver perfil' },
  { name: 'inventario', description: 'Ver inventário' },
  { name: 'arena', description: 'Duelar', options: [{ name:'oponente', type:6, description:'quem', required:true }] },
  { name: 'ranking', description: 'Top 10' },
  { name: 'muralha', description: 'Top 5 vitoriosos' },
  { name: 'tesouro', description: 'Tesouro real' }
];

client.on('ready', async () => {
  console.log(`Abismo online como ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});
const app = express(); app.get('/', (req,res)=>res.send('Abismo online!')); app.listen(3000);
client.login(process.env.TOKEN);
