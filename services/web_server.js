const http = require("http");
const express = require("express");
const morgan = require("morgan");
const webServerConfig = require("../config/web_server.js");
const database = require("./database.js");
const router = require("./router.js");
var multer = require("multer");
var path = require("path");
var fs = require("fs");
const bcrypt = require("bcrypt");
var jwt = require("jsonwebtoken");
var bodyParser = require("body-parser");
let httpServer;
function initialize() {
  return new Promise((resolve, reject) => {
    const app = express();
    httpServer = http.createServer(app);
    app.set("superSecret", "tokenUser"); // secret variable

    // utiliser un analyseur de corps pour obtenir des informations à partir des paramètres POST et / ou URL
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());
    // récupère une instance du routeur pour les routes api
    var apiRoutes = express.Router();

    // routage du middleware pour vérifier un token
    apiRoutes.use(function(req, res, next) {
      // vérifier les paramètres d'en-tête ou d'URL ou publier des paramètres pour le token
      res.header("Access-Control-Allow-Origin", "*"); 
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      var token =
        req.body.token || req.query.token || req.headers["x-access-token"];

      // decode token
      if (token) {
        // vérifie le secret et vérifie exp
        jwt.verify(token, app.get("superSecret"), function(err, decoded) {
          if (err) {
            return res.json({
              success: false,
              code : 201,
              message: "Échec de l'authentification du token."
            });
          } else {
            // si tout va bien, enregistrez-le pour demander son utilisation sur d'autres routes
            req.decoded = decoded;

            console.log(decoded);
            next();
          }
        });
      } else {
        // s'il n'y a pas de token
        // retourne une erreur
        return res.status(403).send({
          success: false,
          message: "veuillez vous connecter à nouveau",
          code:403
        });
      }
    });
    // Combine les informations de journalisation de la demande et de la réponse
    app.use(morgan("combined"));
    app.use("/apiCem", apiRoutes);
    app.all('/*', function(req, res, next) {
      // CORS headers
      res.header("Access-Control-Allow-Origin", "*"); 
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      if (req.method == 'OPTIONS') {
        res.status(200).end();
      } else {
        next();
      }
    });
    app.use("/apiCem", apiRoutes,function(req, res, next) {
      // CORS headers
      res.header("Access-Control-Allow-Origin", "*"); 
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      if (req.method == 'OPTIONS') {
        res.status(200).end();
      } else {
        next();
      }
    });
   

    app.get("/", async (req, res) => {
      const result = await database.simpleExecute(
        "select user, systimestamp from dual"
      );
      const user = result.rows[0].USER;
      const date = result.rows[0].SYSTIMESTAMP;
      // res.end(`DB user: ${user}\nDate: ${date}`);
      res.json(result);
    });

    function autoIncrementUser() {
      return new Promise(async function(resolve, reject) {
        const result = await database.simpleExecute(
          "select count(username) as id from utilisateurs"
        );
        resolve(result.rows[0].ID + 1);
      });
    }

    function autoIncrementCommande() {
      return new Promise(async function(resolve, reject) {
        const result = await database.simpleExecute(
          "select count(ID_COMMANDE) as id from commande"
        );
        resolve(result.rows[0].ID + 1);
      });
    }

    function autoIncrementProduits() {
      return new Promise(async function(resolve, reject) {
        const result = await database.simpleExecute(
          "select count(ID_PROD) as id from produits"
        );
        resolve(result.rows[0].ID + 1);
      });
    }
    function verificationUsername(username) {
      return new Promise(async function(resolve, reject) {
        const result = await database.simpleExecute(
          "select count(username) as nombre from utilisateurs where username = :username",
          { username: username }
        );
        resolve(result.rows[0].NOMBRE);
      });
    }
    function verificationProduits(produits) {
      return new Promise(async function(resolve, reject) {
        const result = await database.simpleExecute(
          "select count(designation) as nombre from produits where designation = :designation",
          { designation : produits }
        );
        resolve(result.rows[0].NOMBRE);
      });
    }
    app.get("/readUser", async (req, res) => {
      const result = await database.simpleExecute("select * from utilisateurs");

      res.json(result);
    });

    // inscription
    app.post("/inscription", async (req, res) => {
      autoIncrementUser().then(data => {
        bcrypt.hash(req.body.password, 12).then(function(hash) {
          let password = hash;
          const utilisateurs = {
            username: req.body.username,
            password: password,
            email: req.body.email,
            id_user: data,
            status_compte:req.body.typecompte
          };

          verificationUsername(utilisateurs.username).then(data => {
            if (data === 1) {
              res.json({code :201, message: "username déjà utilisé" });
            } else {
              const result = database
                .simpleExecute(
                  "insert into utilisateurs (username,email,password,id_user,status_compte) values (:username,:email,:password,:id_user,:status_compte)",
                  utilisateurs,
                  { autoCommit: true }
                )
                .catch(err => {
                  console.log("erreur", err);
                });
                
                const payload = {
                  user: result
                };
                var token = jwt.sign(payload, app.get("superSecret"), {
                  expiresIn: 60 * 60 * 24
                });
              res.json({ code :200 ,message: "bien inscri" , statusCompte: req.body.typecompte , token:token , id_user : utilisateurs.id_user});
            }
          });
        });
      });
    });

    app.post("/login", async (req, res) => {
      let password = req.body.password;
      verificationUsername(req.body.username).then(data => {
        if (data === 1) {
          const result = database
            .simpleExecute(
              "select password,username,id_user,status_compte from utilisateurs where username = :username",
              { username: req.body.username },
              { autoCommit: true }
            )
            .then(user => {
            
              const payload = {
                user: user.rows
              };
              
              if (bcrypt.compareSync(password,user.rows[0].PASSWORD)) {
      
                var token = jwt.sign(payload, app.get("superSecret"), {
                  expiresIn: 60 * 60 * 24
                });
     
                res.json({
                  message: "bien authentifié",
                  code: 200,
                  token: token,
                  username: user.rows[0].USERNAME,
                  id_user : user.rows[0].ID_USER,
                  status_compte : user.rows[0].STATUS_COMPTE

                });
              } else {
                res.json({ message: "Invalid information", code: 201 });
              }
            })
            .catch(err => {
              console.log("err", err);
            });
        } else {
          res.json({ message: "Invalid information", code: 201 });
        }
      });
    });

    //routes avec token
    apiRoutes.get("/", function(req, res) {
      res.json({ message: "Bienvenue avec l'api securisé ;) ",code : 200 });
    });

    
    apiRoutes.get("/lirecommande", async function(req, res) {
      const result = await database.simpleExecute("select * from commande");

      res.json(result);
    });
    apiRoutes.get("/lirecategorie", async function(req, res) {
      const result = await database.simpleExecute("select * from categories");

      res.json(result);
    });
    apiRoutes.get("/lireproduits", async function(req, res) {
      const result = await database.simpleExecute("select * from produits");
      res.json(result);
    });
    
    apiRoutes.post("/ajoutProduit", async (req, res) => {
     
      autoIncrementProduits().then(data => {
    
        const produits = {
          id_prod: 'PROD' + data,
          id_fourniseur: req.body.id_fourniseur,
          designation: req.body.designation,
          cout: req.body.cout,
          id_categorie :req.body.id_categorie,
        };

        verificationProduits(produits.designation).then(data => {
          if (data === 1) {
            res.json({code :201, message: "produits déjà utilisé" });
          } else {
            const result = database
              .simpleExecute(
                "insert into produits (id_prod,id_fourniseur,designation,cout,id_categorie) values (:id_prod,:id_fourniseur,:designation,:cout,:id_categorie)",
                produits,
                { autoCommit: true }
              )
              .catch(err => {
                console.log("erreur", err);
              });
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            res.json({ code :200 ,message: "bien inscri" });
        
          }
        });
      });
    });

    apiRoutes.get("/lirecategories", async function(req, res) {
      const result = await database.simpleExecute("select * from categories");

      res.json(result);
    });


    apiRoutes.post("/ajoutFournisseur", async function(req, res) {
      res.json({ message: "/ajoutFournisseur " });
    });

    app.post("/authenticate", function(req, res) {
      res.header("Access-Control-Allow-Origin", "*");
      // trouver user
      User.findOne(
        {
          name: req.body.name
        },
        function(err, user) {
          if (err) throw err;

          if (!user) {
            res.json({
              success: false,
              message: "Échec de l'authentification.Utilisateur introuvable"
            });
          } else if (user) {
            console.log(user);
            // verification du password
            if (user.password != req.body.password) {
              res.json({
                success: false,
                message: "Échec de l'authentification Mot de passe incorrect."
              });
            } else {
              // si l'utilisateur est trouvé et que le mot de passe est correct
              // créer token

              const payload = {
                admin: user._id
              };
              var token = jwt.sign(payload, app.get("superSecret"), {
                expiresIn: 60 * 60 * 24
              });
              console.log(payload);
              // return l'information avec le token
              res.json({
                success: true,
                message: "bien authentifié",
                token: token
              });
            }
          }
        }
      );
    });
    /*
    // Parse incoming JSON requests and revive JSON.
    app.use(
      express.json({
        reviver: reviveJson
      })
    );

    // Mount the router at /api so all its routes start with /api
    app.use("/api", router);*/

    httpServer
      .listen(webServerConfig.port)
      .on("listening", () => {
        console.log(
          `Serveur Web à l'écoute sur localhost:${webServerConfig.port}`
        );
        resolve();
      })
      .on("error", err => {
        reject(err);
      });
  });
}

module.exports.initialize = initialize;

function close() {
  return new Promise((resolve, reject) => {
    httpServer.close(err => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

module.exports.close = close;

const iso8601RegExp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

function reviveJson(key, value) {
  // revive ISO 8601 date strings to instances of Date
  if (typeof value === "string" && iso8601RegExp.test(value)) {
    return new Date(value);
  } else {
    return value;
  }
}
