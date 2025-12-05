const e = require('express');
const db = require('../db');

// --- OBTENER TODOS LOS USUARIOS ---
exports.getUsuarios = async (req, res) => {
  try {

    const { rol, idEstablecimiento } = req.user; // Datos del token
    const rolesAdmin = ['adminSistema'];
    const esAdmin = rolesAdmin.includes(rol);

    let query = `
       SELECT 
        u.rut_usuario as rut, 
        u.nombre, 
        u.apellido_paterno, 
        u.correo, 
        u.rol, 
        u.activo, 
        u.area,
        u.establecimiento_idEstablecimiento,
        u.bloqueado,
        e.nombre_establecimiento as establecimiento
      FROM usuariov u
      LEFT JOIN establecimiento e ON u.establecimiento_idEstablecimiento = e.idEstablecimiento
      WHERE 1=1
    `;
    const params = [];

    if (!esAdmin) {
        if (idEstablecimiento) {
            query += ' AND u.establecimiento_idEstablecimiento = ?';
            params.push(idEstablecimiento);
        } else {
            return res.status(200).json([]);
        }
    }

    const [rows] = await db.query(query, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

exports.updateUsuario = async (req, res) => {
  try {
    const { rut } = req.params;
    const { 
      nombre, rol, activo, area,ESTABLECIMIENTO_idEstablecimiento
      } = req.body;

   
    let query = 'UPDATE usuario SET ';
    const params = [];
    if (nombre !== undefined) { query += 'nombre = ?, '; params.push(nombre); }
    if (rol !== undefined) { query += 'rol = ?, '; params.push(rol); }
    if (activo !== undefined) { query += 'activo = ?, '; params.push(activo); }
    if (area !== undefined) { query += 'area = ?, '; params.push(area); }
    if (ESTABLECIMIENTO_idEstablecimiento !== undefined) { query += 'establecimiento_idEstablecimiento = ?, '; params.push(ESTABLECIMIENTO_idEstablecimiento); }

     if (params.length === 0) {
      return res.status(200).json({ message: 'Nada que actualizar.' });
    }
    query = query.slice(0, -2);
    query += ' WHERE rut_usuario = ?';
    params.push(rut);

    await db.query(query, params);
    res.status(200).json({ message: 'Usuario actualizado con éxito.' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- OBTENER VEHICULOS CON CONDUCTORES ---
exports.getVehiculosConConductores = async ( req, res ) => {
  try {
    const { rol, idEstablecimiento } = req.user; 
    const rolesAdmin = ['adminSistema'];
    const esAdmin = rolesAdmin.includes(rol);

    let query = `
      SELECT DISTINCT
        v.patente, v.marca, v.modelo, v.ano, v.capacidad, v.revision_tecnica,
        v.nombre_conductor, v.nombre_conductor_reemplazo,
        tv.tipo_vehiculo,
        c.id_contrato, c.rut_proveedor, c.nombre_proveedor, c.fecha_inicio, c.fecha_termino
      FROM vehiculo v
      JOIN tipo_vehiculo tv ON v.tipo_vehiculo_id_tipoVehiculo = tv.id_tipoVehiculo 
      JOIN contrato c ON v.patente = c.vehiculo_patente
      /* JOIN para filtrar por establecimiento */
      LEFT JOIN vehiculo_has_establecimiento vhe ON v.patente = vhe.vehiculo_patente
      WHERE 1=1
    `;

    const params = [];

    if (!esAdmin) {
        if (idEstablecimiento) {
            query += ' AND vhe.establecimiento_idEstablecimiento = ?';
            params.push(idEstablecimiento);
        } else {
            return res.status(200).json([]);
        }
    }

    const [rows] = await db.query(query, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error al obtener vehículos con conductores:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- GESTIÓN DE VEHÍCULOS ---
exports.getVehiculosConDetalles = async (req, res) => {
  try {
    const { rol, idEstablecimiento } = req.user; 
    const rolesAdmin = ['adminSistema'];
    const esAdmin = rolesAdmin.includes(rol);

    let query = `
     SELECT DISTINCT
        v.patente, v.marca, v.modelo, v.ano, v.capacidad, 
        v.revision_tecnica,
        v.permiso_circulacion,
        v.seguro_obligatorio,
        v.nombre_conductor, v.nombre_conductor_reemplazo, v.activo,
        v.necesita_reemplazo, 
        v.patente_reemplazo, 
        v.justificacion_reemplazo, 
        v.revision_tecnica_reemplazo, 
        v.permiso_circulacion_reemplazo, 
        v.seguro_obligatorio_reemplazo, 
        v.marca_reemplazo,
        v.modelo_reemplazo,
        v.ano_reemplazo,
        v.capacidad_reemplazo,
        v.fecha_reemplazoFin,
        v.autorizacion_reemplazo, 
        v.fecha_reemplazo,
        tv.nombre_tipoVehiculo as tipoVehiculo,
        c.nombre_proveedor as responsable,
        c.fecha_termino as fecha_contrato
      FROM vehiculo v
      LEFT JOIN tipo_vehiculotv ON v.tipo_vehiculo_id_tipoVehiculo = tv.id_tipoVehiculo 
      LEFT JOIN contrato c ON v.patente = c.vehiculo_patente
      /* JOIN para filtrar por establecimiento */
      LEFT JOIN vehiculo_has_establecimiento vhe ON v.patente = vhe.vehiculo_patente
      WHERE 1=1
    `;

    const params = [];

    if (!esAdmin) {
        if (idEstablecimiento) {
            query += ' AND vhe.establecimiento_idEstablecimiento = ?';
            params.push(idEstablecimiento);
        } else {
            return res.status(200).json([]);
        }
    }

    const [rows] = await db.query(query, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error al obtener vehículos con detalles:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

exports.updateVehiculo = async (req, res) => {
  try {
    const { patente } = req.params;
    const fields = req.body; 
  if (fields.fecha_reemplazo) {
      fields.fecha_reemplazo = new Date(fields.fecha_reemplazo).toISOString().split('T')[0];
    }
    if (fields.revision_tecnica_reemplazo) {
      fields.revision_tecnica_reemplazo = new Date(fields.revision_tecnica_reemplazo).toISOString().split('T')[0];
    }
    if (fields.revision_tecnica) {
      fields.revision_tecnica = new Date(fields.revision_tecnica).toISOString().split('T')[0];
    }
    if (fields.permiso_circulacion) {
      fields.permiso_circulacion = new Date(fields.permiso_circulacion).toISOString().split('T')[0];
    }
    if (fields.seguro_obligatorio) {
      fields.seguro_obligatorio = new Date(fields.seguro_obligatorio).toISOString().split('T')[0];
    }
    if (fields.permiso_circulacion_reemplazo) {
      fields.permiso_circulacion_reemplazo = new Date(fields.permiso_circulacion_reemplazo).toISOString().split('T')[0];
    }
    if (fields.seguro_obligatorio_reemplazo) {
      fields.seguro_obligatorio_reemplazo = new Date(fields.seguro_obligatorio_reemplazo).toISOString().split('T')[0];
    }
    if (fields.fecha_reemplazoFin) {
      fields.fecha_reemplazoFin = new Date(fields.fecha_reemplazoFin).toISOString().split('T')[0];
    }
 

    let query = 'UPDATE vehiculo SET ';
    const params = [];
    for (const key in fields) {
      if (fields.hasOwnProperty(key)) {
        query += `${key} = ?, `;
        params.push(fields[key]);
      }
    }
    
    if (params.length === 0) {
      return res.status(200).json({ message: 'Nada que actualizar.' });
    }

    query = query.slice(0, -2);
    query += ' WHERE patente = ?';
    params.push(patente);

    await db.query(query, params);
    res.status(200).json({ message: 'Vehículo actualizado con éxito.' });
  } catch (error) {
    console.error('Error al actualizar vehículo:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

exports.desbloquearUsuario = async (req, res) => {
  try {
    const { rut } = req.params;
    await db.query("UPDATE usuario SET bloqueado = 'no', intentos_fallidos = 0 WHERE rut_usuario = ?", [rut]);
    res.status(200).json({ message: 'Usuario desbloqueado con éxito.' });
  } catch (error) {
    console.error('Error al desbloquear usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

exports.getEstablecimientos = async (req, res) => {
  try {
    const query = 'SELECT idEstablecimiento, nombre_establecimiento FROM establecimiento';
    const [rows] = await db.query(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error al obtener establecimientos:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

