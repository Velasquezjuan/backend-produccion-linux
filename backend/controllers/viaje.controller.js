const db = require('../db');

// --- OBTENER TODOS LOS VIAJES ---
exports.getViajes = async (req, res) => {
try {

    const { rol, idEstablecimiento, rut } = req.user; // Datos del token
    const rolesAdmin = ['adminSistema'];
    const esAdmin = rolesAdmin.includes(rol);

    let query = `
        SELECT 
        v.*, v.id_viaje as id,
        solicitante.nombre as nombre_solicitante, solicitante.apellido_paterno as apellido_solicitante, solicitante.correo as correo_solicitante,
        veh.patente as patente_vehiculo,
        prog.nombre_programa,
        COALESCE(tv_asignado.nombre_tipoVehiculo, tv_deseado.nombre_tipoVehiculo) as tipoVehiculo,
        veh.nombre_conductor as nombreConductor,
        'normal' as tipo_origen,
        solicitante.establecimiento_idEstablecimiento
      FROM viaje v
      JOIN usuario solicitante ON v.solicitante_rut_usuario = solicitante.rut_usuario
      LEFT JOIN programa prog ON v.programa_id_programa = prog.id_programa
      LEFT JOIN vehiculo veh ON v.vehiculo_patente = veh.patente
      LEFT JOIN tipo_vehiculo tv_asignado ON veh.tipo_vehiculo_id_tipoVehiculo = tv_asignado.id_tipoVehiculo
      LEFT JOIN tipo_vehiculo tv_deseado ON v.vehiculo_deseado = tv_deseado.id_tipoVehiculo
      WHERE 1=1
    `;
    const params = [];

    if (!esAdmin) {
        if (idEstablecimiento) {
             query += ` AND solicitante.establecimiento_idEstablecimiento = ?`;
             params.push(idEstablecimiento);
        } else {             
             query += ` AND v.solicitante_rut_usuario = ?`;
             params.push(rut);
        }
    }

    query += ` ORDER BY v.fecha_solicitud DESC`;

    const [rows] = await db.query(query, params);
    res.status(200).json(rows);

  } catch (error) {
    
    console.error('Error al obtener viajes:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- CREAR UN NUEVO VIAJE ---
exports.createViaje = async (req, res) => {

  try {
    const {
      fecha_viaje, hora_inicio, punto_salida, punto_destino,
      motivo, ocupantes, programa, responsable, necesita_carga, vehiculo_deseado
    } = req.body;


    const solicitante_rut = req.user.rut;

    if (!solicitante_rut) {
        return res.status(403).json({ message: 'No se pudo identificar al solicitante desde el token.' });
    }

    const query = `
      INSERT INTO viaje (
        fecha_viaje, hora_inicio, punto_salida, punto_destino,
        motivo, ocupantes, programa_id_programa, solicitante_rut_usuario, responsable, necesita_carga, vehiculo_deseado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const [result] = await db.query(query, [
      fecha_viaje, hora_inicio, punto_salida, punto_destino,
      motivo, ocupantes, programa, solicitante_rut, responsable, necesita_carga, vehiculo_deseado
    ]);

 const nuevoViajeId = result.insertId;

    const selectQuery = `
      SELECT 
        v.*,
        u.nombre as nombre_solicitante,
        u.correo as correo_solicitante,
        COALESCE(
          tv_asignado.nombre_tipoVehiculo,
          tv_deseado.nombre_tipoVehiculo
        ) as tipoVehiculo
      FROM viaje v
      JOIN usuario u ON v.solicitante_rut_usuario = u.rut_usuario
      LEFT JOIN vehiculo veh ON v.vehiculo_patente = veh.patente
      LEFT JOIN tipo_vehiculo tv_asignado ON veh.tipo_vehiculo_id_tipoVehiculo = tv_asignado.id_tipoVehiculo
      LEFT JOIN tipo_vehiculo tv_deseado ON v.vehiculo_deseado = tv_deseado.id_tipoVehiculo
      WHERE v.id_viaje = ?
    `;

    const [viajesCreados] = await db.query(selectQuery, [nuevoViajeId]);
    
    if (viajesCreados.length === 0) {
      return res.status(404).json({ message: 'No se pudo encontrar el viaje recién creado.' });
    }
    const viajeCompleto = viajesCreados[0];

    res.status(201).json({ 
      message: 'Viaje solicitado con éxito.',
      viaje: viajeCompleto 
    });

  } catch (error) {
    console.error('Error al crear el viaje:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- ACTUALIZAR ESTADO DE UN VIAJE ---
exports.updateEstadoViaje = async (req, res) => {
    try {
        const { id_viaje } = req.params;
        const { estado, motivo_rechazo, motivo_reagendamiento, vehiculo_patente, fecha_viaje,
           hora_inicio, justificativo_no_realizado, motivo_rechazoReagendamiento } = req.body;

        let query = 'UPDATE viaje SET estado = ?';
        const params = [estado];

        if (motivo_rechazo) {
            query += ', motivo_rechazo = ?';
            params.push(motivo_rechazo);
        }
        if (motivo_reagendamiento) {
            query += ', motivo_reagendamiento = ?';
            params.push(motivo_reagendamiento);
        }
        if (vehiculo_patente) {
            query += ', vehiculo_patente = ?';
            params.push(vehiculo_patente);
        }
        if (fecha_viaje) {
            query += ', fecha_viaje = ?';
            params.push(fecha_viaje);
        }
        if (hora_inicio) {
            query += ', hora_inicio = ?';
            params.push(hora_inicio);
        }

        if (justificativo_no_realizado) {
        query += ', justificativo_no_realizado = ?';
        params.push(justificativo_no_realizado);
       }

       if (motivo_rechazoReagendamiento) {
        query += ', motivo_rechazoReagendamiento = ?';
        params.push(motivo_rechazoReagendamiento);
       }

        query += ' WHERE id_viaje = ?';
        params.push(id_viaje);

        await db.query(query, params);
        res.status(200).json({ message: `Viaje ${estado} con éxito.` });

    } catch (error) {
        console.error('Error al actualizar estado del viaje:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// --- OBTENER BITÁCORA DE UN VEHÍCULO ---
exports.getBitacoraByVehiculo = async (req, res) => {
    try {
        const { patente } = req.params;
        const query = `
            SELECT * FROM viaje 
            WHERE vehiculo_patente = ? 
            ORDER BY fecha_viaje DESC;
        `;
        const [rows] = await db.query(query, [patente]);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error al obtener la bitácora:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
  };

exports.getViajesPorUsuario = async (req, res) => {
    try {
        const { nombre } = req.params;
        if (!nombre) {
            return res.status(403).json({ message: 'No se pudo identificar al usuario desde el token.' });
        }
        const query= `
       SELECT 
        v.*,
        u.nombre as nombre_solicitante, 
        u.apellido_paterno as apellido_solicitante,
        COALESCE(tv_asignado.nombre_tipoVehiculo, tv_deseado.nombre_tipoVehiculo ) as tipoVehiculo
      FROM viaje v
      JOIN usuario u ON v.solicitante_rut_usuario = u.rut_usuario
      LEFT JOIN vehiculo veh ON v.vehiculo_patente = veh.patente
      LEFT JOIN tipo_vehiculo tv_asignado ON veh.tipo_vehiculo_id_tipoVehiculo = tv_asignado.id_tipoVehiculo
      LEFT JOIN tipo_vehiculo tv_deseado ON v.vehiculo_deseado = tv_deseado.id_tipoVehiculo
      WHERE u.nombre = ? 
      ORDER BY v.fecha_viaje DESC, v.hora_inicio DESC`; 

        const [rows] = await db.query(query, [nombre]);
         res.status(200).json(rows);

  } catch (error) {
    console.error('Error al obtener los viajes por usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

exports.createViajeMasivo = async (req, res) => {

  try {
    const {
      fecha_viaje, hora_inicio, punto_salida, punto_destino, vehiculo_patente,
      motivo, ocupantes, programa, responsable, necesita_carga, vehiculo_deseado, estado
    } = req.body;


    const solicitante_rut = req.user.rut;

    if (!solicitante_rut) {
        return res.status(403).json({ message: 'No se pudo identificar al solicitante desde el token.' });
    }

    const query = `
      INSERT INTO viaje_masivo (
        fecha_viaje, hora_inicio, punto_salida, punto_destino,vehiculo_patente,
        motivo, ocupantes, programa_id_programa, solicitante_rut_usuario, responsable, necesita_carga, vehiculo_deseado, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?);
    `;
    const [result] = await db.query(query, [
      fecha_viaje, hora_inicio, punto_salida, punto_destino,vehiculo_patente,
      motivo, ocupantes, programa, solicitante_rut, responsable, necesita_carga, vehiculo_deseado, estado 
    ]);

 const nuevoViajeId = result.insertId;

    const selectQuery = `
      SELECT 
        v.*,
        u.nombre as nombre_solicitante,
        u.correo as correo_solicitante,
        COALESCE(
          tv_asignado.nombre_tipoVehiculo,
          tv_deseado.nombre_tipoVehiculo
        ) as tipoVehiculo
      FROM viaje_masivo v
      JOIN usuario u ON v.solicitante_rut_usuario = u.rut_usuario
      LEFT JOIN vehiculo veh ON v.vehiculo_patente = veh.patente
      LEFT JOIN tipo_vehiculo tv_asignado ON veh.tipo_vehiculo_id_tipoVehiculo = tv_asignado.id_tipoVehiculo
      LEFT JOIN tipo_vehiculo tv_deseado ON v.vehiculo_deseado = tv_deseado.id_tipoVehiculo
      WHERE v.id_viaje = ?
    `;

    const [viajesCreados] = await db.query(selectQuery, [nuevoViajeId]);
    
    if (viajesCreados.length === 0) {
      return res.status(404).json({ message: 'No se pudo encontrar el viaje recién creado.' });
    }
    const viajeCompleto = viajesCreados[0];

    res.status(201).json({ 
      message: 'Viaje solicitado con éxito.',
      viaje: viajeCompleto 
    });

  } catch (error) {
    console.error('Error al crear el viaje:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

exports.getViajesMasivos = async (req, res) => {
  try {
    const { rol, idEstablecimiento, rut } = req.user; // Datos del token
    const rolesAdmin = ['adminSistema'];
    const esAdmin = rolesAdmin.includes(rol);

    let query = `
      SELECT 
        vm.*, vm.id_viaje as id,
        solicitante.nombre as nombre_solicitante, 
        solicitante.apellido_paterno as apellido_solicitante, 
        solicitante.correo as correo_solicitante,
        veh.patente as patente_vehiculo,
        prog.nombre_programa,
        COALESCE(tv_asignado.nombre_tipoVehiculo, 
        Wtv_deseado.nombre_tipoVehiculo) as tipoVehiculo,
        veh.nombre_conductor as nombreConductor,
        'masivo' as tipo_origen,
        solicitante.establecimiento_idEstablecimiento
      FROM viaje_masivo vm
      JOIN usuario solicitante ON vm.solicitante_rut_usuario = solicitante.rut_usuario
      LEFT JOIN programa prog ON vm.programa_id_programa = prog.id_programa
      LEFT JOIN vehiculo veh ON vm.vehiculo_patente = veh.patente
      LEFT JOIN tipo_vehiculo tv_asignado ON veh.tipo_vehiculo_id_tipoVehiculo = tv_asignado.id_tipoVehiculo
      LEFT JOIN tipo_vehiculo tv_deseado ON vm.vehiculo_deseado = tv_deseado.id_tipoVehiculo
      WHERE 1=1  
    `;

   const params = [];

    if (!esAdmin) {
        if (idEstablecimiento) {
             query += ` AND solicitante.establecimiento_idEstablecimiento = ?`;
             params.push(idEstablecimiento);
        } else { 
             query += ` AND vm.solicitante_rut_usuario = ?`;
             params.push(rut);
        }
    }

    query += ` ORDER BY vm.fecha_viaje DESC, vm.hora_inicio DESC`;

  const [rows] = await db.query(query, params);
    res.status(200).json(rows);
    
  } catch (error) {
    console.error('Error al obtener viajes masivos:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};
