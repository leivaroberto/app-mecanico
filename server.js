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

// 1. LOGIN
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: usuario, error } = await supabase
            .from('usuarios_talleres')
            .select('*')
            .eq('email', email.trim())
            .eq('password', password.trim())
            .maybeSingle();

        if (error || !usuario) return res.status(401).json({ exito: false, mensaje: 'Credenciales incorrectas.' });
        res.json({ exito: true, id_taller: usuario.id_taller, nombre_taller: usuario.nombre_taller });
    } catch (err) {
        res.status(500).json({ exito: false, mensaje: 'Error del servidor.' });
    }
});

// 2. GUARDAR MANTENIMIENTO
app.post('/api/guardar-mantenimiento', async (req, res) => {
    const datos = req.body;
    try {
        const { data: clienteData, error: errorCliente } = await supabase
            .from('clientes_vehiculos')
            .insert({
                id_taller: datos.id_taller || 1,
                nombre_completo: datos.nombre,
                telefono: datos.telefono,
                patente: datos.patente.toUpperCase().trim()
            }).select();

        if (errorCliente || !clienteData) return res.status(400).json({ exito: false, mensaje: 'Error al registrar cliente' });

        const id_cliente = clienteData[0].id_cliente;

        const { error: errorMantenimiento } = await supabase
            .from('mantenimientos')
            .insert({
                id_cliente: id_cliente,
                fecha_actual: datos.fecha_servicio,
                kilometraje: Number(datos.kilometraje),
                trabajo_realizado: datos.trabajo,
                trabajo_proximo: datos.trabajo_proximo || '',
                fecha_proximo: datos.fecha_proximo,
                costo: Number(datos.costo) || 0
            });

        if (errorMantenimiento) return res.status(400).json({ exito: false, mensaje: 'Error al registrar mantenimiento' });
        res.json({ exito: true, mensaje: '¡Guardado con éxito!' });
    } catch (err) {
        res.status(500).json({ exito: false, mensaje: 'Error del servidor.' });
    }
});

// 3. BUSCAR POR PATENTE
app.get('/api/registros/buscar', async (req, res) => {
    const { patente, id_taller } = req.query;
    try {
        const { data, error } = await supabase
            .from('clientes_vehiculos')
            .select(`
                id_cliente, nombre_completo, telefono, patente,
                mantenimientos ( id_servicio, fecha_actual, kilometraje, trabajo_realizado, trabajo_proximo, fecha_proximo, costo )
            `)
            .eq('id_taller', id_taller)
            .ilike('patente', `%${patente.trim()}%`);

        if (error) throw error;
        res.json({ exito: true, registros: data });
    } catch (err) {
        res.status(500).json({ exito: false, mensaje: 'Error en búsqueda.' });
    }
});

// 4. AVISOS DE LA SEMANA (Mapea el servicio a realizar al trabajo_proximo)
app.get('/avisos-semana', async (req, res) => {
    const { id_taller } = req.query;
    try {
        const hoy = new Date();
        const hoyStr = hoy.toISOString().split('T')[0];
        const proximoEn7Dias = new Date();
        proximoEn7Dias.setDate(hoy.getDate() + 7);
        const proximoEn7DiasStr = proximoEn7Dias.toISOString().split('T')[0];

        let query = supabase.from('mantenimientos').select(`
                id_servicio, fecha_proximo, trabajo_realizado, trabajo_proximo,
                clientes_vehiculos!inner ( id_taller, nombre_completo, telefono, patente )
            `)
            .gte('fecha_proximo', hoyStr).lte('fecha_proximo', proximoEn7DiasStr).order('fecha_proximo', { ascending: true });

        if (id_taller) query = query.eq('clientes_vehiculos.id_taller', id_taller);
        
        const { data, error } = await query;
        if (error) throw error;

        const avisosNormalizados = (data || []).map(item => ({
            id: item.id_servicio,
            fecha_proximo: item.fecha_proximo,
            // Si existe trabajo_proximo lo usa; de lo contrario usa trabajo_realizado como respaldo
            mantenimiento_realizado: item.trabajo_proximo && item.trabajo_proximo.trim() !== '' ? item.trabajo_proximo : item.trabajo_realizado,
            clientes: { nombre: item.clientes_vehiculos?.nombre_completo, telefono: item.clientes_vehiculos?.telefono },
            vehiculos: { patente: item.clientes_vehiculos?.patente }
        }));
        res.json(avisosNormalizados);
    } catch (err) {
        res.status(500).json({ error: 'Error al consultar avisos.' });
    }
});

// 5. ESTADÍSTICAS DEL MES
app.get('/api/estadisticas', async (req, res) => {
    const { id_taller } = req.query;
    try {
        const hoy = new Date();
        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('mantenimientos')
            .select('costo, clientes_vehiculos!inner(id_taller)')
            .eq('clientes_vehiculos.id_taller', id_taller)
            .gte('fecha_actual', primerDiaMes);

        if (error) throw error;

        const totalVehiculos = data.length;
        const ingresosMes = data.reduce((suma, item) => suma + (Number(item.costo) || 0), 0);

        res.json({ exito: true, totalVehiculos, ingresosMes });
    } catch (err) {
        res.status(500).json({ exito: false, mensaje: 'Error al obtener estadísticas.' });
    }
});

// 6. ELIMINAR REGISTRO
app.delete('/api/mantenimiento/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('mantenimientos').delete().eq('id_servicio', id);
        if (error) throw error;
        res.json({ exito: true, mensaje: 'Registro eliminado correctamente.' });
    } catch (err) {
        res.status(500).json({ exito: false, mensaje: 'Error al eliminar.' });
    }
});

app.listen(port, () => console.log(`Servidor de AppMecanico corriendo en puerto ${port}`));
