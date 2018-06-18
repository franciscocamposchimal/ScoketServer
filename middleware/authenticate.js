'use strict'

var jwt = require('jwt-simple');
var moment = require('moment');
var secret = 'palabra_secreta';

exports.ensureAuth = function(req,res,next){
    if(!req.headers.authorization){
        return res.status(403).send({message: 'Sin cabecera de auth'});
    }
    var token = req.headers.authorization.replace(/['"]+/g, '');
    try{
        var payload = jwt.decode(token, secret);
        if(payload.exp <= moment().unix()){
            return res.status(401).send({
                message: 'Token expired'
            });
        }
    }catch(ex){
        return res.status(402).send({
            message: 'Invalid token'
        });
    }

    req.user = payload;
    next();
};