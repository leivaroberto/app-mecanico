const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.post('/api/guardar-mantenimiento', async (req, res) => {
    const datos = req.body;
    console.log("Recibiendo datos del vehículo:", datos.patente);

    try {
        // 1. Insertar cliente y vehículo
        const { data: clienteData, error: errorCliente } = await supabase
            .from('clientes_vehiculos')
            .insert({
                id_taller: 1,
                nombre_completo: datos.nombre,
                telefono: datos.telefono,
                patente: datos.patente.toUpperCase()
            })
            .select();

        if (errorCliente) {
            console.error("Error al insertar cliente:", errorCliente);
            return res.status(400).json({ exito: false, mensaje: 'Error al registrar cliente: ' + errorCliente.message });
        }

        if (!clienteData || clienteData.length === 0) {
            return res.status(400).json({ exito: false, mensaje: 'No se pudo obtener el ID del cliente registrado.' });
        }

        const id_cliente = clienteData[0].id_cliente;
        console.log("Cliente registrado con ID:", id_cliente);

        // 2. Insertar mantenimiento vinculado
        const { error: errorMantenimiento } = await supabase
            .from('mantenimientos')
            .insert({
                id_cliente: id_cliente,
                fecha_actual: datos.fecha_servicio,
                kilometraje: Number(datos.kilometraje),
                trabajo_realizado: datos.trabajo,
                fecha_proximo: datos.fecha_proximo
            });

        if (errorMantenimiento) {
            console.error("Error al insertar mantenimiento:", errorMantenimiento);
            return res.status(400).json({ exito: false, mensaje: 'Error al registrar mantenimiento: ' + errorMantenimiento.message });
        }

        console.log("¡Mantenimiento guardado con éxito!");
        res.json({ exito: true, mensaje: '¡Cliente y mantenimiento guardados en Supabase!' });

    } catch (err) {
        console.error("Error crítico en servidor:", err);
        res.status(500).json({ exito: false, mensaje: 'Error interno en el servidor.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
});
// Endpoint para iniciar sesión
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Consultar la tabla usuarios_taller en Supabase
        const { data: usuario, error } = await supabase
            .from('usuarios_talleres')
            .select('*')
            .eq('email', email)
            .eq('password', password) // En producción se recomienda cifrar la clave
            .single();

        if (error || !usuario) {
            return res.status(401).json({ 
                exito: false, 
                mensaje: 'Correo o contraseña incorrectos' 
            });
        }

        // Login exitoso: devolver id_taller y nombre_taller
        res.json({
            exito: true,
            id_taller: usuario.id_taller || usuario.id,
            nombre_taller: usuario.nombre_taller
        });

    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});
