"use strict";

var db = require("../models/socios.model");
var Sequelize = require("sequelize");
const cv = require('opencv4nodejs');
var Socio = db.model.socio;
var Fam_Socio = db.model.fam_socio;
var Finger = db.model.finger;

// We will keep a record of all connected sockets
var sockets = [];

//MATCHES
const matchFeatures = ({ img1, img2, detector, matchFunc }) => {
  // detect keypoints
  const keyPoints1 = detector.detect(img1);
  const keyPoints2 = detector.detect(img2);
 
  // compute feature descriptors
  const descriptors1 = detector.compute(img1, keyPoints1);
  const descriptors2 = detector.compute(img2, keyPoints2);
    //console.log("Descriptor1: ",descriptors1.sizes);
    //console.log("Descriptor2: ",descriptors2.sizes);

  // match the feature descriptors
  const matches = matchFunc(descriptors1, descriptors2);
  const newArray = [];
  var score = 0.0;
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
    detector: new cv.ORBDetector(),
    matchFunc: cv.matchBruteForceHamming
  });

  return { match: akazeMatchesImg.scores }

};



exports = module.exports = function(io) {
  io.on("connection", socket => {
    console.log(`El cliente con IP: ${socket.id} se ha conectado`);

    //EVENTO ON SEARCH -> DATA.NOMBRE[INT, TEXT]
    socket.on("SEARCH", data => {
      console.log("DATOS DE BUSQUEDA: ", data.nombre);
      if (data.nombre === "") {
        console.log("DATOS VACÍOS");
      } else {
        Socio.findAll({
          limit: 10,
          where: {
            [Sequelize.Op.and]: [
              {
                [Sequelize.Op.or]: [
                  {
                    nombre: {
                      [Sequelize.Op.like]: ["%" + data.nombre + "%"]
                    }
                  },
                  {
                    nombre: {
                      [Sequelize.Op.like]: [data.nombre + "%"]
                    }
                  },
                  {
                    id: {
                      [Sequelize.Op.eq]: [data.nombre]
                    }
                  }
                ]
              },
              {
                status: {
                  [Sequelize.Op.eq]: [1]
                }
              }
            ]
          }
        })
          .then(socios => {
            console.log("Tamaño arreglo de respuesta: " + socios.length);
            console.log("Tipo: " + typeof socios);
            //EVENTO EMITTER RESULT -> OBJECT{SOCIOS}
            socket.emit("RESULT", {
              socios: socios
            });
          })
          .catch(err => {
            return err;
          });
      }
    });

    var socioInfo;
    var socioFamilia;
    //EVENTO ON FINDSOC -> DATA->ID
    socket.on("FINDSOC", data => {
      Finger.find({
        attributes: [
          "id_persona",
          "tipo",
          [Sequelize.fn("COUNT", Sequelize.col("fp")), "no_fp"]
        ],
        include: [
          {
            model: Socio
          }
        ],
        where: {
          id_persona: data.id,
          tipo: 1
        },
        group: ["id_persona"]
      })
        .then(socio => {
          //console.log("Socio: ", JSON.stringify(socio));
          socioInfo = socio;
        })
        .catch(err => {
          console.log("Error", err);
        });
      Finger.findAll({
        attributes: [
          "id_persona",
          "tipo",
          [Sequelize.fn("COUNT", Sequelize.col("fp")), "no_fp"]
        ],
        include: [
          {
            model: Fam_Socio,
            where: {
              id_socio: data.id
            }
          }
        ],
        where: {
          tipo: 2
        },
        group: ["id_persona"]
      })
        .then(familiar => {
          //console.log("Familiar: ", JSON.stringify(familiar));
          let socioFamiliar = JSON.stringify(familiar);
          socioFamilia = JSON.parse(socioFamiliar);
          //EVENTO EMITTER FOUNDSOC -> OBJ[]
          socket.emit("FOUNDSOC", {
            socio: socioInfo,
            familiares: socioFamilia
          });
        })
        .catch(err => {
          console.log("Error: ", err);
        });
    });

    //EVENTO ENROLL -> OBJ{ID,FP[],TIPO}
    socket.on("ENROLL", data => {

      var fps = JSON.stringify(data.fingers);
      //var fps = createTemplates(data.fingers);
      //console.log(JSON.stringify(fps.fps));
      Finger.create({
        id_persona: data.id,
        tipo: data.tipo,
        fp: fps
      })
        .then(finger => {
          //EVENTO ENROLLED -> BOOL
          if (finger != null) {
            socket.emit("ENROLLED", { enrolled: true });
          } else {
            socket.emit("ENROLLED", { enrolled: false });
          }
        })
        .catch(err => {
          console.log("Error: ", err);
        });
    });

    //EVENTO LOGIN -> OBJ{FP(BASE64),TIPO}
    socket.on("LOGIN", data => {
      //FILTRAR TIPO SOCIO
      if (data.tipo == 1) {
        Finger.findAll({
          include: [
            {
              model: Socio,
              attributes: ["id", "nombre"]
            }
          ],
          where: {
            tipo: 1
          }
        })
          .then(fingers => {   // 33028-38544-->5516
            //PROCESO DE COMPARACIÓN
            //EVENTO EMITTER AUTH -> BOOL

            var scann = data.fp;
            var foundSocio = 0;
            var lengthArray = fingers.length;
            function scannImage(scann, name) {
              return function(tmp, index) {
                  var result =  match(scann, tmp.base);
                  var res = result.match;
                  console.log(`MATCH: ${res}`);
                  if(res > 2200){
                    foundSocio++;
                    console.log("Found: ",foundSocio);
                    if(foundSocio == 2){
                      console.log(`ID: ${name}`, `MATCH: ${res}`);
                      socket.emit("AUTH", { auth: true , name: name});
                      return true;
                    }
                  }else if(index == 2){
                    foundSocio = 0;
                  }
              }
            }
               /* fingers.map((item)=>{
                  console.log("map", item.dataValues.socio.dataValues.id);
                  var nameS = item.dataValues.socio.dataValues.nombre
                  var array = JSON.parse(item.fp);
                  array.map(scannImage(scann, nameS));
                });*/
            const login = fingers.some( (val ,i)=>{
              //console.log("map", val.dataValues.socio.dataValues.id);
              var nameS = val.dataValues.socio.dataValues.nombre;
              //console.log(`name: ${nameS}`,`FP: ${val.fp}`);
              var array = JSON.parse(val.fp);
              const someSoc = array.some(scannImage(scann, nameS));
                if(someSoc){
                  return true;
                }/*else{
                  socket.emit("AUTH", { auth: false , name: "Socio no encontrado..."});
                }*/
            });
            
          })
          .catch(err => {
            console.log("Error: ", err);
          });
      } else {
        Finger.findAll({
          include: [
            {
              model: Socio,
              attributes: ["id", "nombre"]
            }
          ],
          where: {
            tipo: 2
          }
        })
          .then(fingers => {
            //PROCESO DE COMPARACIÓN
            //EVENTO EMITTER AUTH -> BOOL
            console.log(fingers);
          })
          .catch(err => {
            console.log("Error: ", err);
          });
      }
    });

    // Remove disconnected users
    socket.on('disconnect', () => {
      sockets = sockets.filter(function(el) {
        return el.clientID !== socket.id;
      });
      console.log("ARRAY CLEARED: ", sockets);
    });

  });
};
