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

app.post('/api/pacientes', (req, res) => {
    const pacienteInput = req.body;
    if (!pacienteInput.dni) return res.status(400).json({ error: "El DNI es mandatorio" });

    let db = leerBD();
    let index = db.findIndex(p => p.dni === pacienteInput.dni);

    if (index !== -1) {
        const alertasMedicasPrevias = db[index].alertasPendientes || [];
        db[index] = { 
            ...db[index], 
            ...pacienteInput, 
            alertasPendientes: alertasMedicasPrevias,
            ultimaModificacion: Date.now() 
        };
    } else {
        pacienteInput.alertasPendientes = [];
        pacienteInput.datosPresion = pacienteInput.datosPresion || [
            { fecha: "2026-10-25", sistolica: 120, diastolica: 80 },
            { fecha: "2026-10-26", sistolica: 135, diastolica: 85 },
            { fecha: "2026-10-27", sistolica: 155, diastolica: 95 }
        ];
        pacienteInput.ultimaModificacion = Date.now();
        db.push(pacienteInput);
    }

    guardarBD(db);
    res.status(200).json({ success: true, message: "Sincronizado en la nube de Juanki Te Cuida." });
});

app.get('/api/pacientes/:dni/alertas', (req, res) => {
    const { dni } = req.params;
    const db = leerBD();
    const paciente = db.find(p => p.dni === dni);

    if (!paciente) return res.status(404).json({ error: "Paciente no registrado" });

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

app.get('/api/pacientes', (req, res) => {
    res.json(leerBD());
});

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
