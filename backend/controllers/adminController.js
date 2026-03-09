const bcrypt = require("bcryptjs");
const { query } = require("../config/database");

// LISTAR ADMINS
const listarAdmins = async (req,res)=>{
  try{

    const {rows} = await query(`
      SELECT id,nombre,email,activo,ultimo_acceso
      FROM dv_admins
      ORDER BY id
    `);

    res.json(rows);

  }catch(err){
    console.error(err);
    res.status(500).json({error:"Error al obtener admins"});
  }
};


// CREAR ADMIN
const crearAdmin = async (req,res)=>{
  try{

    const {nombre,email,password} = req.body;

    const hash = await bcrypt.hash(password,10);

    await query(`
      INSERT INTO dv_admins
      (nombre,email,password,activo)
      VALUES ($1,$2,$3,TRUE)
    `,[nombre,email,hash]);

    res.json({message:"Administrador creado"});

  }catch(err){

    console.error(err);
    res.status(500).json({error:"Error al crear admin"});

  }
};


// DESACTIVAR ADMIN
const desactivarAdmin = async (req,res)=>{

  try{

    await query(`
      UPDATE dv_admins
      SET activo = FALSE
      WHERE id = $1
    `,[req.params.id]);

    res.json({message:"Administrador desactivado"});

  }catch(err){

    console.error(err);
    res.status(500).json({error:"Error al desactivar"});

  }

};


// ACTIVAR ADMIN
const activarAdmin = async (req,res)=>{

  try{

    await query(`
      UPDATE dv_admins
      SET activo = TRUE
      WHERE id = $1
    `,[req.params.id]);

    res.json({message:"Administrador activado"});

  }catch(err){

    console.error(err);
    res.status(500).json({error:"Error al activar"});

  }

};

module.exports={
  listarAdmins,
  crearAdmin,
  desactivarAdmin,
  activarAdmin
};