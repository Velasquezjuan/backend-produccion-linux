const db = require('../db');

// --- OBTENER TODOS LOS VEHÍCULOS ---
exports.getVehiculos = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM vehiculo');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error al obtener vehículos:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- CREAR UN NUEVO VEHÍCULO ---
exports.createVehiculo = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
  } catch (error) {
    console.error('Error al obtener conexión:', error);
    return res.status(500).json({ message: 'Error de conexión con la base de datos.' });
  }

  try {
    await connection.beginTransaction();

    const {
      patente, marca, modelo, ano, capacidad, tipo_vehiculo, revision_tecnica,permiso_circulacion, seguro_obligatorio,
      nombre_conductor, conductor_reemplazo, rut_proveedor, nombre_proveedor,
      id_contrato, programa, centro, centroSalud1, centroSalud2, centroEducacion, centroAtm,
      fecha_inicio, fecha_termino, horas_contratadas
    } = req.body;

    const capacidadInt = capacidad ? 1 : 0;

    const sqlVehiculo = `
      INSERT INTO vehiculo (
        patente, marca, modelo, ano, capacidad, revision_tecnica, permiso_circulacion, seguro_obligatorio,
        nombre_conductor, nombre_conductor_reemplazo, tipo_vehiculo_id_tipoVehiculo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?,?);
    `;
    await connection.query(sqlVehiculo, [
      patente, marca, modelo, ano, capacidadInt, revision_tecnica, permiso_circulacion, seguro_obligatorio,
      nombre_conductor, conductor_reemplazo, tipo_vehiculo
    ]);

    const sqlContrato = `
      INSERT INTO contrato (
        id_contrato, rut_proveedor, nombre_proveedor, 
        fecha_inicio, fecha_termino, horas_contratadas, vehiculo_patente
      ) VALUES (?, ?, ?, ?, ?, ?, ?);
    `;
    await connection.query(sqlContrato, [
      id_contrato, rut_proveedor, nombre_proveedor, fecha_inicio,     
      fecha_termino, horas_contratadas, patente
    ]);

    if (programa && programa.length > 0) {
      const sqlVehiculoPrograma = 'INSERT INTO vehiculo_has_programa (vehiculo_patente, programa_id_programa) VALUES ?';
      const valoresVehiculoPrograma = programa.map(idPrograma => [patente, idPrograma]);
      await connection.query(sqlVehiculoPrograma, [valoresVehiculoPrograma]);
    }

    const todosLosEstablecimientos = [centro, centroSalud1, centroSalud2, centroEducacion, centroAtm].filter(id => id);
    if (todosLosEstablecimientos.length > 0) {
        const sqlVehiculoEstablecimiento = 'INSERT INTO vehiculo_has_establecimiento (vehiculo_patente, establecimiento_idEstablecimiento) VALUES ?';
        const valoresVehiculoEstablecimiento = todosLosEstablecimientos.map(idEst => [patente, idEst]);
        await connection.query(sqlVehiculoEstablecimiento, [valoresVehiculoEstablecimiento]);
    }

    await connection.commit();
    res.status(201).json({ message: 'Vehículo y asociaciones registrados con éxito.' });

  } catch (error) {
    await connection.rollback();
    console.error('Error en la transacción de registro de vehículo:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'La patente o el número de contrato ya están registrados.' });
    }
    res.status(500).json({ message: 'Error interno del servidor al registrar.', error: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
// --- OBTENER VEHÍCULOS CON CONDUCTORES ASIGNADOS ---
exports.getVehiculos = async (req, res) => {
  try {
    const query = `
      SELECT 
        v.patente as id,
        v.patente,
        v.capacidad,
        tv.nombre_tipoVehiculo as tipoVehiculo,
        v.nombre_conductor as nombreConductor 
      FROM vehiculo v
      LEFT JOIN tipo_vehiculo tv ON v.tipo_vehiculo_id_tipoVehiculo = tv.id_tipoVehiculo;
    `;

    const [vehiculos] = await db.query(query);
    res.status(200).json(vehiculos);

  } catch (error) {
    console.error('Error al obtener los vehículos con conductor:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- OBTENER VEHICULOS POR programa ---
exports.getVehiculosPorPrograma = async (req, res) => {
  try {
    const { id_programa } = req.params;

    const { rol, idEstablecimiento } = req.user; 
   
    const rolesAdmin = ['adminSistema'];
    const esAdmin = rolesAdmin.includes(rol);

    let query = `
      SELECT DISTINCT
        v.patente as id,
        v.patente,
        v.capacidad,
        tv.nombre_tipoVehiculo as tipoVehiculo,
        v.nombre_conductor as nombreConductor
      FROM vehiculo v
      JOIN tipo_vehiculo tv ON v.tipo_vehiculo_id_tipoVehiculo = tv.id_tipoVehiculo
      JOIN vehiculo_has_programa vhp ON v.patente = vhp.vehiculo_patente
      LEFT JOIN vehiculo_has_establecimiento vhe ON v.patente = vhe.vehiculo_patente
      WHERE vhp.programa_id_programa = ? AND v.activo = 'si'
    `;
    const params = [id_programa];
  
    if (!esAdmin) {
        if (idEstablecimiento) {
            query += ` AND vhe.establecimiento_idEstablecimiento = ?`;
            params.push(idEstablecimiento); 
        } else {
            return res.status(200).json([]); 
        }
    }
    const [vehiculos] = await db.query(query, params);

    res.status(200).json(vehiculos);

  } catch (error) {
    console.error('Error al obtener vehículos por programa:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};


// --- OBTENER TIPOS DE VEHÍCULO POR PROGRAMA ---
exports.getTiposVehiculoPorPrograma = async (req, res) => {
  try {
    const { id_programa } = req.params;

    const query = `
      SELECT DISTINCT 
        tv.id_tipoVehiculo as value, 
        tv.nombre_tipoVehiculo as label
      FROM vehiculo v
      JOIN tipo_vehiculo tv ON v.tipo_vehiculo_id_tipoVehiculo = tv.id_tipoVehiculo
      JOIN vehiculo_has_programa vhp ON v.patente = vhp.vehiculo_patente
      WHERE vhp.programa_id_programa = ? AND v.activo = 'si';
    `;
    
    const [tipos] = await db.query(query, [id_programa]);
    res.status(200).json(tipos);

  } catch (error) {
    console.error('Error al obtener tipos de vehículo por programa:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- OBTENER PROGRAMAS ASOCIADOS A UN VEHÍCULO ---
exports.getProgramasPorVehiculo = async (req, res) => {
  try {
    const { patente } = req.params;
    
    const query = `
      SELECT DISTINCT
        p.id_programa as value,
        p.nombre_programa as label
      FROM programa p
      JOIN vehiculo_has_programa vhp ON p.id_programa = vhp.programa_id_programa
      WHERE vhp.vehiculo_patente = ?;
    `;
    
    const [programas] = await db.query(query, [patente]);
    res.status(200).json(programas);

  } catch (error) {
    console.error('Error al obtener programas por vehículo:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- OBTENER VEHÍCULOS MASIVOS ---
exports.getVehiculosMasivos = async (req, res) => {
  try {
    const { rol, idEstablecimiento } = req.user; 
    
    // Roles que pueden ver TODO
    const rolesAdmin = ['adminSistema'];
    const esAdmin = rolesAdmin.includes(rol);

    let query = `
      SELECT DISTINCT
        v.patente as id,
        v.patente,
        v.capacidad,
        tv.nombre_tipoVehiculo as tipoVehiculo,
        v.nombre_conductor as nombreConductor 
      FROM vehiculo v
      JOIN tipo_vehiculo tv ON v.tipo_vehiculo_id_tipoVehiculo = tv.id_tipoVehiculo
      LEFT JOIN vehiculo_has_establecimiento vhe ON v.patente = vhe.vehiculo_patente
      WHERE v.activo = 'si'
    `;

    const params = [];

    if (!esAdmin) {
        if (idEstablecimiento) {
            query += ` AND vhe.establecimiento_idEstablecimiento = ?`;
            params.push(idEstablecimiento);
        } else {
            return res.status(200).json([]);
        }
    }

    const [vehiculos] = await db.query(query, params);
    res.status(200).json(vehiculos);

  } catch (error) {
    console.error('Error al obtener vehículos masivos:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};