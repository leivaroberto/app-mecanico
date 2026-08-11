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

        const fechaProximoFinal = (datos.fecha_proximo && datos.fecha_proximo.trim() !== '') 
            ? datos.fecha_proximo 
            : null;

        const { error: errorMantenimiento } = await supabase
            .from('mantenimientos')
            .insert({
                id_cliente: id_cliente,
                fecha_actual: datos.fecha_servicio,
                kilometraje: Number(datos.kilometraje),
                trabajo_realizado: datos.trabajo,
                trabajo_proximo: datos.trabajo_proximo || null,
                fecha_proximo: fechaProximoFinal,
                costo: Number(datos.costo) || 0,
                aviso_enviado: false
            });

        if (errorMantenimiento) {
            return res.status(400).json({ exito: false, mensaje: 'Error al registrar mantenimiento: ' + errorMantenimiento.message });
        }
        
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
                mantenimientos ( id_servicio, fecha_actual, kilometraje, trabajo_realizado, trabajo_proximo, fecha_proximo, costo, aviso_enviado )
            `)
            .eq('id_taller', id_taller)
            .ilike('patente', `%${patente.trim()}%`);

        if (error) throw error;
        res.json({ exito: true, registros: data });
    } catch (err) {
        res.status(500).json({ exito: false, mensaje: 'Error en búsqueda.' });
    }
});

// 4. AVISOS DE LA SEMANA
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
            .not('fecha_proximo', 'is', null)
            .or('aviso_enviado.is.null,aviso_enviado.eq.false')
            .gte('fecha_proximo', hoyStr)
            .lte('fecha_proximo', proximoEn7DiasStr)
            .order('fecha_proximo', { ascending: true });

        if (id_taller) query = query.eq('clientes_vehiculos.id_taller', id_taller);
        
        const { data, error } = await query;
        if (error) throw error;

        const avisosNormalizados = (data || []).map(item => ({
            id: item.id_servicio,
            fecha_proximo: item.fecha_proximo,
            mantenimiento_realizado: item.trabajo_proximo && item.trabajo_proximo.trim() !== '' ? item.trabajo_proximo : item.trabajo_realizado,
            clientes: { nombre: item.clientes_vehiculos?.nombre_completo, telefono: item.clientes_vehiculos?.telefono },
            vehiculos: { patente: item.clientes_vehiculos?.patente }
        }));
        res.json(avisosNormalizados);
    } catch (err) {
        res.status(500).json({ error: 'Error al consultar avisos.' });
    }
});

// 5. MARCAR AVISO COMO ENVIADO
app.post('/api/marcar-aviso-enviado', async (req, res) => {
    const { id_servicio } = req.body;
    try {
        const { error } = await supabase
            .from('mantenimientos')
            .update({ aviso_enviado: true })
            .eq('id_servicio', id_servicio);

        if (error) throw error;
        res.json({ exito: true });
    } catch (err) {
        res.status(500).json({ exito: false, mensaje: 'Error al actualizar estado.' });
    }
});

// 6. ESTADÍSTICAS DEL MES
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

// 7. ELIMINAR REGISTRO
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

// 8. HISTORIAL GENERAL (CORREGIDO CON JOINS Y NOMBRES DE COLUMNAS REALES)
app.get('/api/historial-servicios', async (req, res) => {
    try {
        const { id_taller, patente, fechaInicio, fechaFin } = req.query;

        let query = supabase
            .from('mantenimientos')
            .select(`
                id_servicio, fecha_actual, kilometraje, trabajo_realizado, trabajo_proximo, fecha_proximo, costo,
                clientes_vehiculos!inner ( id_taller, nombre_completo, telefono, patente )
            `)
            .order('fecha_actual', { ascending: false });

        if (id_taller) {
            query = query.eq('clientes_vehiculos.id_taller', id_taller);
        }

        if (patente && patente.trim() !== '') {
            query = query.ilike('clientes_vehiculos.patente', `%${patente.trim()}%`);
        }

        if (fechaInicio) {
            query = query.gte('fecha_actual', fechaInicio);
        }
        if (fechaFin) {
            query = query.lte('fecha_actual', fechaFin);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Formatear respuesta para el frontend
        const historialFormateado = (data || []).map(item => ({
            id: item.id_servicio,
            fecha: item.fecha_actual,
            cliente: item.clientes_vehiculos?.nombre_completo,
            telefono: item.clientes_vehiculos?.telefono,
            patente: item.clientes_vehiculos?.patente,
            kilometraje: item.kilometraje,
            trabajo: item.trabajo_realizado,
            trabajo_proximo: item.trabajo_proximo,
            fecha_proximo: item.fecha_proximo,
            costo: item.costo
        }));

        res.json({ success: true, data: historialFormateado });
    } catch (error) {
        console.error('Error al obtener el historial:', error);
        res.status(500).json({ success: false, message: 'Error del servidor al obtener historial.' });
    }
});

app.listen(port, () => console.log(`Servidor de AppMecanico corriendo en puerto ${port}`));
