async function buscarPorPatente() {
    const patente = document.getElementById('buscarPatente').value.trim();
    const idTaller = localStorage.getItem('id_taller'); // O la variable donde guardes el ID del taller

    if (!patente) {
        alert("Por favor, ingrese una patente para buscar.");
        return;
    }

    try {
        const response = await fetch(`${URL_BACKEND}/api/registros/buscar?patente=${patente}&id_taller=${idTaller}`);
        const result = await response.json();

        if (result.exito) {
            mostrarRegistrosEnTabla(result.registros); // Usas la misma función con la que dibujas tu tabla actual
        } else {
            alert("No se encontraron registros para esa patente.");
        }
    } catch (error) {
        console.error("Error en la búsqueda:", error);
        alert("Error de conexión al buscar.");
    }
}
