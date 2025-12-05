require('dotenv').config();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router(); 
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// --- REGISTRO DE USUARIO ---
exports.register = async (req, res) => {
  try {
    const { rut_usuario,
  nombre,
  apellido_paterno,
  apellido_materno,
  correo,
  contrasena,
  rol,
  area,
  centro,
  establecimiento,
} = req.body;


 let establecimientoIdFinal;
    const centroId = parseInt(centro, 10);

  if (centroId === 2) { 
      if (!establecimiento) {
        return res.status(400).json({ message: 'Debe seleccionar un establecimiento de Salud válido.' });
      }
      establecimientoIdFinal = establecimiento; 
    } else {
      establecimientoIdFinal = centroId; 
    }

    const salt = await bcrypt.genSalt(10);
    const contrasenaHasheada = await bcrypt.hash(contrasena, salt);

    const query = `INSERT INTO usuario (
    rut_usuario,
    nombre,
    apellido_paterno,
    apellido_materno,
    correo,
    contrasena,
    rol,
    area,
    establecimiento_idEstablecimiento
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?,?)`;
    
    
 await db.query(query, [
  rut_usuario,
  nombre,
  apellido_paterno,
  apellido_materno,
  correo,
  contrasenaHasheada,
  rol,
  area,
  establecimientoIdFinal
    ]);

    res.status(201).json({ message: 'Usuario registrado con éxito.' });

  } catch (error) {
    console.error('Error en el registro:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'El correo o RUT ya está en uso.' });
    }
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- LOGIN DE USUARIO ---
exports.login = async (req, res) => {
  try {
    const { correo, contrasena } = req.body;
    
    const [usuarios] = await db.query('SELECT * FROM usuario WHERE correo = ?', [correo]);
    
    if (usuarios.length === 0) {
      return res.status(401).json({ message: 'Correo o contraseña incorrectos.' });
    }
    
    const usuario = usuarios[0];

    // VERIFICAR SI LA CUENTA ESTÁ BLOQUEADA 
    if (usuario.bloqueado === 'si') {
      return res.status(403).json({ message: 'Cuenta bloqueada. Contacte a un administrador.' });
    }

    //  COMPARAR CONTRASEÑA 
    const esValida = await bcrypt.compare(contrasena, usuario.contrasena);

    if (esValida) {
      //  RESETEAR INTENTOS Y ENVIAR TOKEN 
      if (usuario.intentos_fallidos > 0) {
        await db.query('UPDATE usuario SET intentos_fallidos = 0 WHERE rut_usuario = ?', [usuario.rut_usuario]);
      }
      
      const token = jwt.sign(
        { rut: usuario.rut_usuario, 
          nombre: usuario.nombre, 
          rol: usuario.rol, correo: 
          usuario.correo,
          idEstablecimiento: usuario.ESTABLECIMIENTO_idEstablecimiento
       },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      return res.status(200).json({ token, usuario });

    } else {

      const nuevosIntentos = usuario.intentos_fallidos + 1;
      const MAX_INTENTOS = 5; // numero maximo de intentos para bloquear la cuenta, se puede cambiar desde aqui
      
      let query = 'UPDATE usuario SET intentos_fallidos = ?';
      const params = [nuevosIntentos];

      if (nuevosIntentos >= MAX_INTENTOS) {
        query += ", bloqueado = 'si'";
      }
      query += ' WHERE rut_usuario = ?';
      params.push(usuario.rut_usuario);
      
      await db.query(query, params);


      if (nuevosIntentos >= MAX_INTENTOS) {
        
        try {
          const mailOptions = {
            from: `"GECOVI" <${process.env.EMAIL_USER}>`,
            to: usuario.correo,
            subject: 'Alerta de Seguridad: Su Cuenta Esta Bloqueada',
            html: `<p>Hola ${usuario.nombre},</p>
                   <p>Tu cuenta ha sido bloqueada temporalmente debido a 5 intentos fallidos de inicio de sesión.</p>
                   <p>Para desbloquearla, por favor, contacta a un administrador del sistema.</p>`
          };
          await transporter.sendMail(mailOptions);
          console.log(`Correo de bloqueo enviado a ${usuario.correo}`);
        } catch (emailError) {
          console.error('Error al enviar el correo de bloqueo:', emailError);
        }

        return res.status(403).json({ message: 'Su cuenta fue Bloqueada por Seguridad. Contacte a un administrador.' });
      } else {
        const intentosRestantes = MAX_INTENTOS - nuevosIntentos;
        const mensaje = `Correo o contraseña incorrectos. Quedan ${intentosRestantes} ${intentosRestantes === 1 ? 'intento' : 'intentos'}.`;
        return res.status(401).json({ message: mensaje });
      }
    }

  } catch (error) {
    console.error('Error en el login:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- OBTENER TODOS LOS USUARIOS ---
exports.getTodosLosUsuarios = async (req, res) => {
  try {
    const query = 'SELECT * FROM usuario';
    const [usuarios] = await db.query(query);
    res.status(200).json(usuarios);
  } catch (error) {
    console.error('Error al obtener todos los usuarios:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

exports.buscarUsuarioPorRut = async (req, res) => {
  try {
    const { rut } = req.body;
    
    const [usuarios] = await db.query('SELECT correo, nombre FROM usuario WHERE rut_usuario = ?', [rut]);
    
    if (usuarios.length === 0) {
      return res.status(404).json({ message: 'RUT no encontrado.' });
    }
    
    res.status(200).json({ correo: usuarios[0].correo, nombre: usuarios[0].nombre });

  } catch (error) {
    console.error('Error al buscar usuario por RUT:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};