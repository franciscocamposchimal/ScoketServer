"use strict";

var db = require("../models/socios.model");
var Sequelize = require("sequelize");
const cv = require('opencv4nodejs');
var Socio = db.model.socio;
var Finger = db.model.finger;

// We will keep a record of all connected sockets
var sockets = [];

//MATCHES
const matchFeatures = ({ img1, img2, detector, matchFunc }) => {
  // detect keypoints
  const keyPoints1 = detector.detect(img1);
  const keyPoints2 = detector.detect(img2);
  console.log("Descriptor1 :",keyPoints1.length);
  console.log("Descriptor2 :",keyPoints2.length);
  // compute feature descriptors
  const descriptors1 = detector.compute(img1, keyPoints1);
  const descriptors2 = detector.compute(img2, keyPoints2);

  // match the feature descriptors
  const matches = matchFunc(descriptors1, descriptors2);
  const newArray = [];
  var score = 0.0;
  var sig = 1;
  for(var i=0; i < matches.length; i++){
    if(i+1 < matches.length){
      if((Math.abs( matches[i].distance/matches[i+1].distance)) < 0.75){
 
    newArray.push(matches[i]);
    score = score + matches[i].distance;
      }
    }
  }
  // only keep good matches
  return {scores: score};
};

//Match function
function match (fpScan, fpFound) {

  const baseIn = Buffer.from(fpScan,'base64')
  const baseItem = Buffer.from(fpFound,'base64');
      
  const imgScan = cv.imdecode(baseIn);
  const imgStorage = cv.imdecode(baseItem);

  const grayImg1 = imgScan.bgrToGray();
  const grayImg2 = imgStorage.bgrToGray();
  //Binarize imges
  const img1 = grayImg1.threshold(127,255,cv.THRESH_BINARY_INV | cv.THRESH_OTSU);
  const img2 = grayImg2.threshold(127,255,cv.THRESH_BINARY_INV | cv.THRESH_OTSU);

  const akazeMatchesImg = matchFeatures({
    img1,
    img2,
    detector: new cv.AKAZEDetector(),
    matchFunc: cv.matchBruteForceHamming
  });

  return { match: akazeMatchesImg.scores }

};

exports = module.exports = function (io) {
  io.on("connection", (socket) => {
   
    console.log(`El cliente con IP: ${socket.id} se ha conectado`);
    // Save a specific socket-client
    sockets.push({clientID:socket.id});
    console.log("Sockets connected: ", sockets);
    socket.on("input", data => {


      /*if(akazeMatchesImg.scores > 10000){
        //console.log("Enviando a...",socket.id);
        socket.emit("server", { match: akazeMatchesImg.scores, login: true });
      }else {
        //console.log("Enviando a...",socket.id);
        socket.emit("server", { match: akazeMatchesImg.scores, login: false });
      }*/
    });

    socket.on("in", data => {
      console.log("DATOS DE ANDROID", data);
    });

    console.log("Enviando test");
    socket.on("MSNTEST", data => {
      console.log("MSN DE CLIENTE: " + data);
    });

    //Evento on busqueda
    socket.on("busqueda", data => {
      console.log("DATOS DE BUSQUEDA: ", data.nombre);
      if (data.nombre === "") {
        console.log("DATOS VACÍOS");
      } else {
        Socio
          .findAll({
            limit: 10,
            where: {
              [Sequelize.Op.and]: [
                {
                  [Sequelize.Op.or]: [
                    {
                      nombre: {
                        [Sequelize.Op.like]: ['%' + data.nombre + '%']
                      }
                    },
                    {
                      nombre: {
                        [Sequelize.Op.like]: [data.nombre + '%']
                      }
                    }
                  ]
                }, {
                  status: {
                    [Sequelize.Op.eq]: [1]
                  }
                }
              ]
            }
          })
          .then(socios => {
            console.log("Tamaño arreglo de respuesta: " + socios.length);
            console.log("Tipo: " + typeof (socios));
            //Evento emit resulado
            socket.emit("resultado", {
              socios: socios
            });
          })
          .catch(err => {
            return err;
          });
      }
    });
    //Evento socioRegistrarChecar\data.id
    socket.on("socioRegistrarChecar", data => {
      //Comparar el id que viene con si se encuentra en la lista
      Socio.find({
        attributes: ['id', 'nombre', [Sequelize.fn('COUNT', Sequelize.col('fp')), 'no_fp']],
        include: [{
          model: Finger,
          attributes: []
        }],
        where: {
          status: 1,
          id: data.id
        },
        group: ['id_socio'],
        having: Sequelize.where(Sequelize.fn('COUNT', Sequelize.col('fp')), '>', 1)
      })
        .then(socio => {
          console.log(socio);
          if ((socio == null) || (socio < 0) || (socio === 0)) {
            //Evento socioRegistrado true(Registrado)
            socket.emit("socioRegistrado", {
              socioRegistrado: false
            });
          } else {
            //Evento socioRegistrado false(No registrado)
            socket.emit("socioRegistrado", {
              socioRegistrado: true
            });
          }
        })
        .catch(err => {
          console.log("Error: ", err);
        });
    });
    //Evento autenticarLista\data.nombre
    socket.on("autenticarLista", data => {
      //Evento resultadoAutenticar
      Socio.findAll({
        attributes: ['id', 'nombre', [Sequelize.fn('COUNT', Sequelize.col('fp')), 'no_fp']],
        include: [{
          model: Finger,
          attributes: []
        }],
        where: {
          status: 1
        },
        group: ['id_socio'],
        having: Sequelize.where(Sequelize.fn('COUNT', Sequelize.col('fp')), '>', 4)
      })
        .then(listaSocios => {
          //Evento resultadoAutenticarLista
          socket.emit("resultadoAutenticarLista", { listaSociosAutenticar: listaSocios });
        })
        .catch(err => {
          console.log("Error: ", err);
        });
    });
    //Evento socioAutenticar\data.id
    socket.on("socioAutenticar", data => {
      Finger.findAll({
        attributes: ['id_socio', 'fp'],
        where: {
          id_socio: data.id
        }
      })
        .then(fingers => {
          //Evento socioFingers
          socket.emit("socioFingers", { fingers: fingers });
        })
        .catch(err => {
          console.log("Error", err);
        });
    });
    //Evento socioRegistro\data.id
    socket.on("socioRegistro", data => {
     Socio.find({
        attributes: ['id', 'nombre'],
        where: {
          status: 1,
          id: data.id
        }
      })
        .then(socio => {
          //Evento socioInfo
          socket.emit("socioInfo", { socio: socio });
        })
        .catch(err => {
          console.log("Error: ", err);
        });
    });
    //Evento socioRegistrarFingers\data.id,data.fp
    socket.on("socioRegistrarFingers", data => {
      Finger.create({
        id_socio: data.id,
        fp: data.fp
      })
        .then(finger => {
          if ((finger == null) || (finger < 0) || (finger === 0)) {
            //Evento socioRegistroFinger
            socket.emit("socioRegistroFinger", { finger: false });
          } else {
            //Evento socioRegistroFinger
            socket.emit("socioRegistroFinger", { finger: true });
          }
        })
        .catch(err => {
          console.log("Error: ", err);
        });
    });

    // Remove disconnected users
    socket.on('disconnect', () => {
      sockets = sockets.filter(function(el) {
        return el.clientID !== socket.id;
      });
      console.log("ARRAY CLEARED: ", sockets);
    });
  });
}