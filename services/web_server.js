const http = require('http');
const express = require('express');
const morgan = require('morgan');
const webServerConfig = require('../config/web_server.js');

let httpServer;

function initialize() {
  return new Promise((resolve, reject) => {
    const app = express();
    httpServer = http.createServer(app);

    // Combine les informations de journalisation de la demande et de la réponse
    app.use(morgan('combined'));

    app.get('/', (req, res) => {
      res.end('Hello World!');
    });

    httpServer.listen(webServerConfig.port)
      .on('listening', () => {
        console.log(`Serveur Web à l'écoute sur localhost:${webServerConfig.port}`);
        resolve();
      })
      .on('error', err => {
        reject(err);
      });
  });
}

module.exports.initialize = initialize;

function close() {
  return new Promise((resolve, reject) => {
    httpServer.close((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

module.exports.close = close;