const db = require('../db');

exports.getCentros = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM centro ORDER BY nombre_centro');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error al obtener centros:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};
