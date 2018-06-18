"use strict";

var app = require("./app");
var server = require("http").Server(app);
var Sequelize = require("sequelize");
var sequelize = new Sequelize("gps", "gil", "", {
  host: "localhost",
  dialect: "mysql",
  port: 3306,
  define: {
    underscored: true
  }
});
//sockets events
var socketEvents = require("./socketEvents/socios");

// socket con cors
var io = require("socket.io")(server, {
  log: true,
  agent: false,
  origins: "*:*",
  transports: [
    "websocket",
    "htmlfile",
    "xhr-polling",
    "jsonp-polling",
    "polling"
  ]
});

var port = process.env.PORT || 4042;
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

sequelize
  .authenticate()
  .then(() => {
    console.log("Conexión satisfactoria");
    socketEvents(io);
    server.listen(port, () => {
      console.log(`Server local con sockets corriendo...${port}`);
    });
  })
  .catch(err => {
    console.error("Error al conectarse a BD", err);
  });