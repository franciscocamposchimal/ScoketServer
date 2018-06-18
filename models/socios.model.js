"use strict";

var Sequelize = require("sequelize");
var sequelize = new Sequelize(
  "cobranzatest",
  "cobranzauser",
  "SvZmbT7FWSXRNQ",
  {
    host: "db4free.net",
    dialect: "mysql",
    port: 3306,
    define: {
      underscored: true
    }
  }
);
//SvZmbT7FWSXRNQ
//basededatos
//u792411292_cobra
//user mysql
//u792411292_cobra
//host mysql
//mysql.hostinger.mx
/*
var sequelize = new Sequelize("cobranza", "userOmar", "1234", {
  host: "dwmedios.dyndns.org",
  dialect: "mysql",
  define: {
    underscored: true
  }
});*/
/*
var sequelize = new Sequelize("sql3239182", "sql3239182", "yi5cl55ceJ", {
  host: "sql3.freemysqlhosting.net",
  dialect: "mysql",
  port: 3306,
  define: {
    underscored: true
  }
});
*/
var Socio = sequelize.define(
  "socios",
  {
    nombre: {
      type: Sequelize.STRING,
      allowNull: false
    },
    status: {
      type: Sequelize.INTEGER(11),
      allowNull: false
    },
    pag_adel: {
      type: Sequelize.INTEGER(11),
      allowNull: false
    }
  },
  {
    timestamps: false,
    tableName: "socios"
  }
);

var Finger = sequelize.define(
  "finger",
  {
    id_persona: {
      type: Sequelize.INTEGER(11),
      references: {
        model: Socio,
        key: "id"
      },
      allowNull: false
    },
    tipo: {
      type: Sequelize.INTEGER(3),
      allowNull: false
    },
    fp: {
      type: Sequelize.TEXT,
      allowNull: false
    }
  },
  {
    timestamps: true,
    tableName: "finger"
  }
);

var Fam_Socio = sequelize.define(
  "fam_socio",
  {
    id_socio: {
      type: Sequelize.INTEGER(11),
      references: {
        model: Socio,
        key: "id"
      },
      allowNull: true
    },
    tipo: {
      type: Sequelize.INTEGER(3),
      allowNull: true
    },
    nombre: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    correo: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    fecha_nac: {
      type: Sequelize.DATE,
      allowNull: true
    }
  },
  {
    timestamps: false,
    tableName: "fam_socio"
  }
);

//Socio.hasMany(Finger, { foreignKey: "id_persona", sourceKey: "id" });
Finger.belongsTo(Socio, { foreignKey: "id_persona", sourceKey: "id" });
Socio.hasMany(Fam_Socio, { foreignKey: "id_socio", sourceKey: "id" });
Fam_Socio.belongsTo(Socio, { foreignKey: "id_socio", sourceKey: "id" });
//Fam_Socio.hasMany(Finger, { foreignKey: "id_persona", sourceKey: "id" });
Fam_Socio.hasOne(Finger, { foreignKey: "id_persona" });
Finger.belongsTo(Fam_Socio, { foreignKey: "id_persona", sourceKey: "id" });

exports.model = {
  socio: Socio,
  finger: Finger,
  fam_socio: Fam_Socio
};
