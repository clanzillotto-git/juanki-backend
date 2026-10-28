---

### ☁️ 2. Servidor Central Nube (Backend Node.js + Express)

Este script crea el servicio de escucha HTTP para centralizar las tramas enviadas por los smartphones y distribuirlas de inmediato al panel de administración del médico. Cuenta con una base de datos local en memoria (que persiste a JSON) para evitar configuraciones complejas de motores de bases de datos de terceros.

```javascript
// ARCHIVO: server.js (Node.js Backend)
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'historia_clinica_db.json');

app.use(cors());
app.use(express.json());

// Inicialización segura de persistencia local en archivo estructurado JSON
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

function leerBD() {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function guardarBD(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ==========================================
// ENDPOINTS PARA LAS APPS MÓVILES (PACIENTES)
// ==========================================

// 1. Envío o actualización de datos clínicos desde el smartphone
app.post('/api/pacientes', (req, res) => {
    const pacienteInput = req.body;
    if (!pacienteInput.dni) return res.status(400).json({ error: "El DNI es mandatorio" });

    let db = leerBD();
    let index = db.findIndex(p => p.dni === pacienteInput.dni);

    if (index !== -1) {
        // Preservar alertas previas generadas por el médico para que no se pisen al sincronizar la app
        const alertasMedicasPrevias = db[index].alertasPendientes || [];
        db[index] = { 
            ...db[index], 
            ...pacienteInput, 
            alertasPendientes: alertasMedicasPrevias,
            ultimaModificacion: Date.now() 
        };
    } else {
        // Nuevo paciente registrado de forma autónoma desde un smartphone
        pacienteInput.alertasPendientes = [];
        pacienteInput.datosPresion = pacienteInput.datosPresion || [
            { fecha: "2026-10-25", sistolica: 120, diastolica: 80 },
            { fecha: "2026-10-26", sistolica: 135, diastolica: 85 },
            { fecha: "2026-10-27", sistolica: 155, diastolica: 95 } // Data inicial para demostración de curvas
        ];
        pacienteInput.ultimaModificacion = Date.now();
        db.push(pacienteInput);
    }

    guardarBD(db);
    res.status(200).json({ success: true, message: "Sincronizado en la nube de Juanki Te Cuida." });
});

// 2. Canal de escucha de la App para recibir alarmas e indicaciones en tiempo real desde el médico
app.get('/api/pacientes/:dni/alertas', (req, res) => {
    const { dni } = req.params;
    const db = leerBD();
    const paciente = db.find(p => p.dni === dni);

    if (!paciente) return res.status(404).json({ error: "Paciente no registrado" });

    // Devolver las alertas y vaciar la cola una vez consumidas por el smartphone
    const alertas = paciente.alertasPendientes || [];
    paciente.alertasPendientes = []; 
    guardarBD(db);

    res.json({
        alarmaPresion: paciente.alarmaPresion || "140/90",
        alertasNuevas: alertas
    });
});

// ==========================================
// ENDPOINTS PARA LA WEB (PANEL DEL MÉDICO)
// ==========================================

// 3. Obtener la grilla total de datos clínicos para el Administrador Web
app.get('/api/pacientes', (req, res) => {
    res.json(leerBD());
});

// 4. Despacho de alertas/indicaciones del médico hacia un paciente específico
app.post('/api/alertas', (req, res) => {
    const { dni, alarmaPresion, mensajeAlerta } = req.body;
    let db = leerBD();
    let paciente = db.find(p => p.dni === dni);

    if (!paciente) return res.status(404).json({ error: "Paciente inexistente" });

    if (alarmaPresion) paciente.alarmaPresion = alarmaPresion;
    if (mensajeAlerta) {
        if (!paciente.alertasPendientes) paciente.alertasPendientes = [];
        paciente.alertasPendientes.push({
            id: Date.now(),
            fecha: new Date().toISOString().split('T')[0],
            mensaje: mensajeAlerta
        });
    }

    guardarBD(db);
    res.json({ success: true, message: "Mensaje inyectado en la cola del dispositivo." });
});

// Lanzamiento del Servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor Juanki Te Cuida operativo en puerto ${PORT}`);
});