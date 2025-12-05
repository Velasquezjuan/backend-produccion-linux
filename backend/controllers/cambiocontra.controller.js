const db = require('../db');
const crypto = require('crypto'); 
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer'); 


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.solicitarReseteo = async (req, res) => {
  try {
    const { rut } = req.body;
    const [usuarios] = await db.query('SELECT * FROM usuario WHERE rut_usuario = ?', [rut]);

    if (usuarios.length === 0) {
      // Respondemos con éxito para no revelar si un RUT existe o no
      return res.status(200).json({ message: 'Si el RUT es válido, se enviará un correo.' });
    }
    
    const usuario = usuarios[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 3600000); // 1 hora de expiración

    await db.query('UPDATE usuario SET reset_token = ?, reset_token_expira = ? WHERE rut_usuario = ?', [token, expira, rut]);

    const resetLink = `http://localhost:8100/nueva-contrasena?token=${token}`;

    const mailOptions = {
      from: `"GECOVI" <${process.env.EMAIL_USER}>`,
      to: usuario.correo,
      subject: 'Recuperación de Contraseña - GECOVI',
      html: `<p>Hola ${usuario.nombre},</p>
             <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace para continuar:</p>
             <a href="${resetLink}">Restablecer Contraseña</a>
             <p>Si no solicitaste esto, por favor ignora este correo.</p>`
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Si el RUT es válido, se enviará un correo.' });

  } catch (error) {
    console.error('Error al solicitar reseteo:', error);
    res.status(500).json({ message: 'Error interno.' });
  }
};

exports.verificarToken = async (req, res) => {
  try {
    const { token } = req.params;
    const [usuarios] = await db.query('SELECT * FROM usuario WHERE reset_token = ? AND reset_token_expira > NOW()', [token]);

    if (usuarios.length === 0) {
      return res.status(404).json({ message: 'Token inválido o expirado.' });
    }
    res.status(200).json({ message: 'Token válido.' });
  } catch (error) {
    res.status(500).json({ message: 'Error interno.' });
  }
};

exports.resetearContrasena = async (req, res) => {
  try {
    const { token, contrasena } = req.body;
    
    if (!token || !contrasena) {
      return res.status(400).json({ message: 'Faltan datos.' });
    }

    const [usuarios] = await db.query('SELECT * FROM usuario WHERE reset_token = ? AND reset_token_expira > NOW()', [token]);

    if (usuarios.length === 0) {
      return res.status(400).json({ message: 'Token inválido o expirado.' });
    }

    const usuario = usuarios[0];
    const nuevaContrasenaHash = await bcrypt.hash(contrasena, 10);

    await db.query(
      "UPDATE usuario SET contrasena = ?, reset_token = NULL, reset_token_expira = NULL, bloqueado = 'no', intentos_fallidos = 0 WHERE rut_usuario = ?",
      [nuevaContrasenaHash, usuario.rut_usuario]
    );

    res.status(200).json({ message: 'Contraseña actualizada con éxito.' });
  } catch (error) {
    console.error('Error al resetear contraseña:', error);
    res.status(500).json({ message: 'Error interno.' });
  }
};