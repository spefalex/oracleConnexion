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
    app.get("/lirecommande", async (req, res) => {
      const result = await database.simpleExecute("select * from commande");

      res.json(result.rows);
    });
    // commmande
    app.post("/AjoutCommande", async (req, res) => {
      autoIncrementCommande().then(data => {
        
          const commande = {
            id_commande :'BONCOM'+data,
            id_responsable: req.body.id_responsable,
            designation_commande: req.body.designation_commande,
            date_commande: new Date(),
            id_frs: req.body.id_frs,
            status_commande: 'EN ATTENTE'
          };

        const result = database
          .simpleExecute(
            "insert into commande (id_commande,id_responsable,designation_commande,date_commande,id_frs,status_commande) values (:id_commande,:id_responsable,:designation_commande,:date_commande,:id_frs,:status_commande)",
            commande,
            { autoCommit: true }
          )
          .catch(err => {
            console.log("erreur", err);
          });
          
        
        
        res.json({ code :200 ,message: "bien inscri" });
       
      });
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


    apiRoutes.put("/updateProd", async (req, res) => {
      const produits = {
        id_prod : req.body.id_prod,
        designation :req.body.designation,
        cout :req.body.cout,
        id_categorie:req.body.id_categorie
      };
  
      const result = database
      .simpleExecute(
        "update produits set designation = :designation ,cout = :cout, id_categorie = : id_categorie where id_prod = : id_prod",
        produits,
        { autoCommit: true }
      )
      .catch(err => {
        console.log("erreur", err);
      });
      res.json({ message: "bien modifié",code : 200 });
    });
    

    app.put("/updateCom", async (req, res) => {
      const commande = {
        id_commande : req.body.id_commande,
        designation_commande :req.body.designation_commande,
        id_frs :req.body.id_frs,
      };

      const result = database
      .simpleExecute(
        "update commande set id_commande = :id_commande ,designation_commande= : designation_commande, id_frs = : id_frs where id_commande = : id_commande",
        commande,
        { autoCommit: true }
      )
      .catch(err => {
        console.log("erreur", err);
      });
      res.json({ message: "bien modifié",code : 200 });
    });


    app.post("/deleteCom", async (req, res) => {
      const commande = {
        id_commande : req.body.id_commande,
      };
      const result = database
      .simpleExecute(
        " delete from commande where id_commande = : id_commande",
        commande,
        { autoCommit: true }
      )
      .catch(err => {
        console.log("erreur", err);
      });
      res.json({ message: "bien suprimmer",code : 200 });
    });

    app.post("/deleteProduit", async (req, res) => {
      const produit = {
        id_prod : req.body.id_prod,
      };
      const result = database
      .simpleExecute(
        " delete from produits where id_prod = : id_prod",
        produit,
        { autoCommit: true }
      )
      .catch(err => {
        console.log("erreur", err);
      });
      res.json({ message: "bien suprimmer",code : 200 });
    });


    apiRoutes.put("/updateProd", async (req, res) => {
      const produits = {
        id_prod : req.body.id_prod,
        designation :req.body.designation,
        cout :req.body.cout,
        id_categorie:req.body.id_categorie
      };
  
      const result = database
      .simpleExecute(
        "update produits set designation = :designation ,cout = :cout, id_categorie = : id_categorie where id_prod = : id_prod",
        produits,
        { autoCommit: true }
      )
      .catch(err => {
        console.log("erreur", err);
      });
      res.json({ message: "bien modifié",code : 200 });
    });
    
    apiRoutes.get("/lirecommande", async function(req, res) {
      const result = await database.simpleExecute("select * from commande");

      res.json(result);
    });

      
    app.get("/lireProduit", async function(req, res) {
      let id =  req.query.idProd;
      const result = await database.simpleExecute
      ("select * from produits where id_prod = :id_prod", {id_prod: id})
     
     
      res.json(result);
    });

    apiRoutes.get("/lirecategorie", async function(req, res) {
      const result = await database.simpleExecute("select * from categories");

      res.json(result);
    });

  
    apiRoutes.get("/lireproduits", async function(req, res) {
      const result = await database.simpleExecute("select p.id_prod,u.username,p.designation as nom_produit,p.cout,c.designation_categorie as type_categorie from produits p join categories c on p.id_categorie = c.id_categorie join utilisateurs u on u.id_user = p.id_fourniseur");
      res.json(result);
    });
    

    function produitParFourniseur(id_fourniseur) {
      return new Promise(async function(resolve, reject) {
        const result = await database.simpleExecute(
          "select p.id_prod,u.username,p.designation as nom_produit,p.cout,c.designation_categorie as type_categorie from produits p join categories c on p.id_categorie = c.id_categorie join utilisateurs u on u.id_user = p.id_fourniseur where p.id_fourniseur = :id_fourniseur",
          { id_fourniseur: id_fourniseur }
        );
        resolve(result.rows);
      });
    }

    apiRoutes.get("/lireproduitsByUser",function(req, res) {
      produitParFourniseur(req.query.id_user).then(data=>{
        res.json(data);
      })

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
