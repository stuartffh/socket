const express = require("express");
const { createServer } = require("http"); // Alterado para http
const socketIO = require("socket.io");
const axios = require("axios");
const jwt = require('jsonwebtoken');
const cors = require("cors");
const bodyParser = require("body-parser");
const cheerio = require("cheerio");
const fs = require("fs").promises;

const playerListFilePath = "./playerTypes.json";
const PORT = process.env.PORT || 3001;
const app = express();

// Configuração do middleware
app.use(cors());
app.use(bodyParser.json());

// Criação do servidor HTTP
const httpServer = createServer(app);
const io = new socketIO.Server(httpServer, {
  cors: {
    origin: "*", // Ajuste isso conforme necessário para a segurança
    methods: ["GET", "POST"]
  }
});

// Rotas do backend
const secretKey = "TibiaClasInfo";

// Variável de guilds monitoradas
let guildsToMonitor = ["Vitality", "Fuleragem", "Bombro", "Ourobra Encore", "Counterplay", "United Pune", "Rasteibra Encore", "Xandebro"];

// Função para obter jogadores de uma guild específica
const getPlayerListByGuild = async (guildName) => {
  const timeStamp = Date.now();
  const url = `https://www.tibia.com/community/?subtopic=guilds&page=view&order=level_desc&GuildName=${encodeURIComponent(guildName)}&onlyshowonline=1&nocache=${timeStamp}`;
  
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    let playerListFromResponse = [];

    $('tr[bgcolor="#F1E0C6"], tr[bgcolor="#D4C0A1"]').map((index, element) => {
      const columns = $(element).find('td');
      if (columns.length >= 4) {
        const name = $(columns[1]).text().trim();
        const vocation = $(columns[2]).text().trim();
        const level = parseInt($(columns[3]).text().trim(), 10);
        const status = $(columns[5]).text().trim();
        const type = "main";

        const playerTemp = {
          name: name,
          vocation: vocation.split(" ").map(word => word.charAt(0)).join(""),
          level: level,
          status: status,
          type: type,
          timeInGame: timeStamp
        };

        playerListFromResponse.push(playerTemp);
      }
    });

    return playerListFromResponse;
  } catch (e) {
    console.error(`Erro ao obter jogadores da guilda ${guildName}:`, e);
    return [];
  }
};

// Função para obter jogadores de todas as guilds monitoradas
const getPlayerLists = async () => {
  const allGuildPlayers = {};
  
  for (const guildName of guildsToMonitor) {
    const guildPlayers = await getPlayerListByGuild(guildName);
    allGuildPlayers[guildName] = guildPlayers;
  }

  io.emit('guildPlayerLists', allGuildPlayers); // Envia os dados separados por guilda
};

// Configuração do socket
io.on("connection", (socket) => {
  socket.on('updateGuilds', (data) => {
    guildsToMonitor = data.guilds; // Atualiza as guildas monitoradas
    console.log("Guilds atualizadas:", guildsToMonitor);
  });
  
  socket.emit('guildPlayerLists', {}); // Envia uma lista vazia inicial
});

// Tarefa periódica para buscar jogadores
setInterval(async () => {
  await getPlayerLists();
}, 5000); // Atualiza os dados a cada 5 segundos

// Inicia o servidor
httpServer.listen(PORT, () => {
  console.log(`Servidor escutando na porta ${PORT}`);
});
