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
    console.log("Recibiendo datos del cliente:", datos.nombre);

    try {
        // 1. Guardar el cliente y pedir explícitamente que devuelva el registro completo
        const { data: clienteInsertado, error: errorCliente } = await supabase
            .from('Clientes_Vehiculos')
            .insert({
                id_taller: 1, 
                nombre_completo: datos.nombre,
                telefono: datos.telefono,
                patente: datos.patente
            })
            .select()
            .single(); // Forzamos a que devuelva un solo objeto limpio

        if (errorCliente) {
            console.error("❌ Error Supabase (Cliente):", errorCliente);
            return res.status(400).json({ exito: false, mensaje: 'Error al registrar cliente: ' + errorCliente.message });
        }

        const id_cliente = clienteInsertado.id_cliente;
        console.log("✔ Cliente guardado con éxito. ID obtenido:", id_cliente);

        // 2. Guardar el mantenimiento usando el ID obtenido
        const { error: errorMantenimiento } = await supabase
            .from('Mantenimientos')
            .insert({
                id_cliente: id_cliente,
                fecha_actual: datos.fecha_servicio,
                kilometraje: Number(datos.kilometraje),
                trabajo_realizado: datos.trabajo,
                fecha_proximo: datos.fecha_proximo
            });

        if (errorMantenimiento) {
            console.error("❌ Error Supabase (Mantenimiento):", errorMantenimiento);
            return res.status(400).json({ exito: false, mensaje: 'Error al registrar mantenimiento: ' + errorMantenimiento.message });
        }

        console.log("✔ Mantenimiento guardado y vinculado correctamente.");
        res.json({ exito: true, mensaje: '¡Cliente y mantenimiento grabados en Supabase con éxito!' });

    } catch (error) {
        console.error("❌ Error interno crítico:", error);
        res.status(500).json({ exito: false, mensaje: 'Error interno en el servidor.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
});
