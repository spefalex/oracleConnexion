const webServer = require('./services/web_server.js');
const database = require('./services/database.js');
const dbConfig = require('./config/database.js');
const defaultThreadPoolSize = 4;

// Increase thread pool size by poolMax
process.env.UV_THREADPOOL_SIZE = dbConfig.hrPool.poolMax + defaultThreadPoolSize;

async function startup() {
  console.log('Lancer l\'application');

  try {
    console.log('Initialisation du module de base de données');

    await database.initialize();
  } catch (err) {
    console.error(err);

    process.exit(1); // Non-zero failure code
  }

  try {
    console.log('initialisation du module de serveur Web');

    await webServer.initialize();
  } catch (err) {
    console.error(err);

    process.exit(1); // Non-zero failure code
  }
}

startup();

async function shutdown(e) {
  let err = e;

  console.log('Fermeture de l\'application');

  try {
    console.log('Fermeture du module serveur Web');

    await webServer.close();
  } catch (e) {
    console.error(e);

    err = err || e;
  }

  try {
    console.log('Fermeture du module base de données');

    await database.close();
  } catch (e) {
    console.error(e);

    err = err || e;
  }

  console.log('Processus sortant');

  if (err) {
    process.exit(1); // Non-zero failure code
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => {
  console.log('SIGTERM reçu');

  shutdown();
});

process.on('SIGINT', () => {
  console.log('SIGINT reçu');

  shutdown();
});

process.on('uncaughtException', err => {
  console.log('Exception non interceptée');
  console.error(err);

  shutdown(err);
});