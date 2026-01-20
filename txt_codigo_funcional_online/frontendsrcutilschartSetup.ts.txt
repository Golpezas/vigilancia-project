// src/utils/chartSetup.ts
// Setup global Chart.js - Evita unused import en componentes
import Chart from 'chart.js/auto';

// Registro global (una vez por app)
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;
// Opcional: colores dark/light theme