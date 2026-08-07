const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Permite que tu HTML se comunique con este servidor sin bloqueos de seguridad
app.use(cors());
app.use(express.json());

// Ruta de prueba para verificar que el servidor está vivo
app.get('/', (req, res) => {
    res.send('¡El Backend de AppMecanico está funcionando perfectamente en Render!');
});

// Ruta preparada para recibir los datos del formulario en el futuro
app.post('/api/guardar-mantenimiento', (req, res) => {
    const datosRecibidos = req.body;
    console.log("Datos recibidos del mecánico:", datosRecibidos);
    
    // Aquí conectaremos con Supabase más adelante
    res.json({ exito: true, mensaje: 'Datos recibidos correctamente en el servidor' });
});

app.listen(port, () => {
    console.log(`Servidor de AppMecanico corriendo en el puerto ${port}`);
});
