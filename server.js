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
    console.log("Intentando guardar datos:", datos);

    try {
        // 1. Guardar el cliente
        const { data: cliente, error: errorCliente } = await supabase
            .from('Clientes_Vehiculos')
            .insert([
                {
                    id_taller: 1, 
                    nombre_completo: datos.nombre,
                    telefono: datos.telefono,
                    patente: datos.patente
                }
            ])
            .select();

        if (errorCliente) {
            console.error("Error en Supabase (Cliente):", errorCliente);
            return res.status(400).json({ exito: false, mensaje: 'Error al guardar cliente: ' + errorCliente.message });
        }

        if (!cliente || cliente.length === 0) {
            return res.status(400).json({ exito: false, mensaje: 'No se pudo obtener el ID del cliente.' });
        }

        const id_cliente = cliente[0].id_cliente;

        // 2. Guardar el mantenimiento
        const { error: errorMantenimiento } = await supabase
            .from('Mantenimientos')
            .insert([
                {
                    id_cliente: id_cliente,
                    fecha_actual: datos.fecha_servicio,
                    kilometraje: datos.kilometraje,
                    trabajo_realizado: datos.trabajo,
                    fecha_proximo: datos.fecha_proximo
                }
            ]);

        if (errorMantenimiento) {
            console.error("Error en Supabase (Mantenimiento):", errorMantenimiento);
            return res.status(400).json({ exito: false, mensaje: 'Error al guardar mantenimiento: ' + errorMantenimiento.message });
        }

        res.json({ exito: true, mensaje: '¡Cliente y mantenimiento guardados en Supabase con éxito!' });
    } catch (error) {
        console.error("Error crítico en el servidor:", error);
        res.status(500).json({ exito: false, mensaje: 'Error interno en el servidor.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
});
