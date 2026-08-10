const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Conexión a Supabase usando las variables de entorno de Render
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 1. ENDPOINT DE INICIO DE SESIÓN (LOGIN)
// ==========================================
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data: usuario, error } = await supabase
            .from('usuarios_talleres')
            .select('*')
            .eq('email', email.trim())
            .eq('password', password.trim())
            .maybeSingle();

        if (error || !usuario) {
            return res.status(401).json({ 
                exito: false, 
                mensaje: 'Correo o contraseña incorrectos.' 
            });
        }

        res.json({
            exito: true,
            id_taller: usuario.id_taller,
            nombre_taller: usuario.nombre_taller
        });

    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor en el login.' });
    }
});

// ==========================================
// 2. ENDPOINT PARA GUARDAR MANTENIMIENTO
// ==========================================
app.post('/api/guardar-mantenimiento', async (req, res) => {
    const datos = req.body;
    console.log("Recibiendo datos del vehículo:", datos.patente);

    try {
        // 1. Insertar cliente y vehículo con el id_taller dinámico
        const { data: clienteData, error: errorCliente } = await supabase
            .from('clientes_vehiculos')
            .insert({
                id_taller: datos.id_taller || 1, // Usa el id del taller logueado
                nombre_completo: datos.nombre,
                telefono: datos.telefono,
                patente: datos.patente.toUpperCase().trim()
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

// ==========================================
// 3. ENDPOINT PARA BUSCAR REGISTROS POR PATENTE
// ==========================================
app.get('/api/registros/buscar', async (req, res) => {
    const { patente, id_taller } = req.query;

    if (!patente || !id_taller) {
        return res.status(400).json({ exito: false, mensaje: 'Faltan parámetros de búsqueda (patente e id_taller).' });
    }

    try {
        // Consultamos la tabla clientes_vehiculos e incluimos los mantenimientos asociados
        const { data, error } = await supabase
            .from('clientes_vehiculos')
            .select(`
                id_cliente,
                nombre_completo,
                telefono,
                patente,
                mantenimientos (
                    id_servicio,
                    fecha_actual,
                    kilometraje,
                    trabajo_realizado,
                    fecha_proximo
                )
            `)
            .eq('id_taller', id_taller)
            .ilike('patente', `%${patente.trim()}%`);

        if (error) throw error;

        res.json({ exito: true, registros: data });

    } catch (err) {
        console.error("Error al buscar por patente:", err);
        res.status(500).json({ exito: false, mensaje: 'Error al realizar la búsqueda: ' + err.message });
    }
});

// Arrancar el servidor escuchando en el puerto asignado
app.listen(port, () => {
    console.log(`Servidor de AppMecanico corriendo en el puerto ${port}`);
});
