const SUPABASE_URL = 'https://bkctyootqmknpvjqebam.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
    'sb_publishable_9jVeGH4L4mC2KdfTP3tJNA_v6hHc289';

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);


// ==========================================
// LOGIN
// ==========================================

const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');

if (loginForm) {

    loginForm.addEventListener('submit', async (event) => {

        event.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        loginMessage.textContent = 'Iniciando sesión...';

        const { error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {

            loginMessage.textContent =
                'Correo o contraseña incorrectos.';

            return;
        }

        window.location.href = 'dashboard.html';

    });

}


// ==========================================
// DASHBOARD
// ==========================================

const patientName = document.getElementById('patientName');
const logoutButton = document.getElementById('logoutButton');
const minHeartRateInput =
    document.getElementById('minHeartRate');

const maxHeartRateInput =
    document.getElementById('maxHeartRate');

const minSpo2Input =
    document.getElementById('minSpo2');

const saveThresholdsButton =
    document.getElementById('saveThresholdsButton');

const settingsMessage =
    document.getElementById('settingsMessage');

let idPersonaActual = null;

if (patientName) {

    cargarDashboard();

}
// ==========================================
// HISTORIAL SEMANAL
// ==========================================

async function cargarHistorial(idDispositivo, umbrales) {

    const historyTableBody =
        document.getElementById('historyTableBody');

    if (!historyTableBody) {
        return;
    }


    // Fecha de hace 7 días
    const fechaInicio = new Date();

    fechaInicio.setDate(fechaInicio.getDate() - 7);


    // ==========================================
    // OBTENER MEDICIONES
    // ==========================================

    const { data: mediciones, error } =
        await supabaseClient
            .from('mediciones')
.select(`
    id_medicion,
    fecha_hora,
    frecuencia_cardiaca,
    spo2,
    latitud,
    longitud,
    direccion
`)
            .eq('id_dispositivo', idDispositivo)
            .gte('fecha_hora', fechaInicio.toISOString())
            .order('fecha_hora', { ascending: false });


    if (error) {

        console.error(
            'Error al obtener el historial:',
            error
        );

        historyTableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    No se pudo cargar el historial.
                </td>
            </tr>
        `;

        return;
    }


    // ==========================================
    // SI NO HAY MEDICIONES
    // ==========================================

    if (!mediciones || mediciones.length === 0) {

        historyTableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    No hay mediciones registradas durante los últimos 7 días.
                </td>
            </tr>
        `;

        return;
    }
    // ==========================================
// CALCULAR RESUMEN SEMANAL
// ==========================================

const totalMeasurements =
    mediciones.length;


// Promedio de frecuencia cardíaca
const totalHeartRate =
    mediciones.reduce(
        (suma, medicion) =>
            suma + Number(medicion.frecuencia_cardiaca),
        0
    );

const averageHeartRate =
    totalHeartRate / totalMeasurements;


// Promedio de SpO₂
const totalSpo2 =
    mediciones.reduce(
        (suma, medicion) =>
            suma + Number(medicion.spo2),
        0
    );

const averageSpo2 =
    totalSpo2 / totalMeasurements;


// Obtener las alertas reales registradas
let totalAlerts = 0;

if (mediciones.length > 0) {

    const idsMediciones = mediciones.map(
        (medicion) => medicion.id_medicion
    );

    const { data: alertas, error: alertasError } =
        await supabaseClient
            .from('alertas')
            .select(
                'id_medicion, tipo_alerta, valor_detectado, umbral'
            )
            .in('id_medicion', idsMediciones);

    if (alertasError) {

        console.error(
            'Error al obtener las alertas:',
            alertasError
        );

    } else {

        totalAlerts = alertas ? alertas.length : 0;

        const alertsTableBody =
            document.getElementById('alertsTableBody');

        if (alertsTableBody) {

            if (!alertas || alertas.length === 0) {

                alertsTableBody.innerHTML = `
                    <tr>
                        <td colspan="4">
                            No hay alertas registradas durante los últimos 7 días.
                        </td>
                    </tr>
                `;

            } else {

                alertsTableBody.innerHTML = '';

                alertas.forEach((alerta) => {

                    const medicionRelacionada =
                        mediciones.find(
                            (medicion) =>
                                medicion.id_medicion ===
                                alerta.id_medicion
                        );

                    let fechaFormateada = '--';

                    if (medicionRelacionada) {

                        const fecha =
                            new Date(
                                medicionRelacionada.fecha_hora
                            );

                        fechaFormateada =
                            fecha.toLocaleString('es-MX', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                            });
                    }

                    let valor = alerta.valor_detectado;
                    let umbral = alerta.umbral;

                    if (
                        alerta.tipo_alerta
                            .toLowerCase()
                            .includes('spo2')
                    ) {
                        valor += ' %';
                        umbral += ' %';
                    } else {
                        valor += ' BPM';
                        umbral += ' BPM';
                    }

                    const fila =
                        document.createElement('tr');

                    fila.innerHTML = `
                        <td>${fechaFormateada}</td>
                        <td>${alerta.tipo_alerta}</td>
                        <td>${valor}</td>
                        <td>${umbral}</td>
                    `;

                    alertsTableBody.appendChild(fila);
                });
            }
        }
    }
}


// ==========================================
// MOSTRAR RESUMEN
// ==========================================

document.getElementById(
    'totalMeasurements'
).textContent =
    totalMeasurements;


document.getElementById(
    'averageHeartRate'
).textContent =
    Math.round(averageHeartRate) + ' BPM';


document.getElementById(
    'averageSpo2'
).textContent =
    averageSpo2.toFixed(1) + ' %';


document.getElementById(
    'totalAlerts'
).textContent =
    totalAlerts;
    // ==========================================
// GRÁFICA SEMANAL
// ==========================================

// WEEKLY CHART
const chartCanvas = document.getElementById('weeklyChart');

if (chartCanvas) {
    if (window.weeklyChart instanceof Chart) {
        window.weeklyChart.destroy();
    }

    // Copia de las mediciones en orden cronológico
    const medicionesGrafica = [...mediciones].reverse();

    const fechas = medicionesGrafica.map((medicion) => {
        const fecha = new Date(medicion.fecha_hora);

        return fecha.toLocaleString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    });

    const bpmData = medicionesGrafica.map((medicion) =>
        Number(medicion.frecuencia_cardiaca)
    );

    const spo2Data = medicionesGrafica.map((medicion) =>
        Number(medicion.spo2)
    );

    window.weeklyChart = new Chart(
        chartCanvas,
        {
            type: 'line',

            data: {
                labels: fechas,

                datasets: [
                    {
                        label: 'Frecuencia cardíaca (BPM)',
                        data: bpmData,
                        yAxisID: 'yBPM',
                        tension: 0.3,
                        pointRadius: 2
                    },
                    {
                        label: 'SpO₂ (%)',
                        data: spo2Data,
                        yAxisID: 'ySpO2',
                        tension: 0.3,
                        pointRadius: 2
                    }
                ]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                interaction: {
                    mode: 'index',
                    intersect: false
                },

scales: {

    x: {
        ticks: {
            autoSkip: true,
            maxTicksLimit: window.innerWidth <= 480 ? 5 : 10,
            maxRotation: 45,
            minRotation: window.innerWidth <= 480 ? 45 : 0
        }
    },

    yBPM: {
        type: 'linear',
        position: 'left',
        beginAtZero: false,
        title: {
            display: true,
            text: 'BPM'
        }
    },

    ySpO2: {
        type: 'linear',
        position: 'right',
        min: 80,
        max: 100,
        title: {
            display: true,
            text: 'SpO₂ (%)'
        },

        grid: {
            drawOnChartArea: false
        }
    }
},

                plugins: {
                    legend: {
                        display: true
                    }
                }
            }
        }
    );
}


    // ==========================================
    // GENERAR FILAS
    // ==========================================

    historyTableBody.innerHTML = '';


    mediciones.forEach((medicion) => {

        const fecha = new Date(medicion.fecha_hora);

        const fechaFormateada =
            fecha.toLocaleString('es-MX', {
                dateStyle: 'short',
                timeStyle: 'short'
            });


        // Comprobar estado de BPM
        const frecuenciaFuera =
            medicion.frecuencia_cardiaca <
                umbrales.frecuencia_cardiaca_min ||
            medicion.frecuencia_cardiaca >
                umbrales.frecuencia_cardiaca_max;


        // Comprobar estado de SpO₂
        const spo2Fuera =
            medicion.spo2 < umbrales.spo2_min;


        const alerta =
            frecuenciaFuera || spo2Fuera;


        // Ubicación
        let ubicacion = '--';

        if (medicion.direccion) {

            ubicacion = medicion.direccion;

        } else if (
            medicion.latitud !== null &&
            medicion.longitud !== null
        ) {

            ubicacion =
                medicion.latitud +
                ', ' +
                medicion.longitud;

        }


        // Estado
        const estado = alerta
            ? '⚠️ Alerta'
            : 'Normal';


        // Crear fila
        const fila = document.createElement('tr');

        fila.innerHTML = `
            <td>${fechaFormateada}</td>

            <td>
                ${medicion.frecuencia_cardiaca} BPM
            </td>

            <td>
                ${medicion.spo2} %
            </td>

            <td>
                ${ubicacion}
            </td>

            <td>
                ${estado}
            </td>
        `;


        historyTableBody.appendChild(fila);

    });

}

// ==========================================
// CARGAR INFORMACIÓN DEL USUARIO
// ==========================================

async function cargarDashboard() {

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();


    // Si no hay sesión iniciada
    if (error || !user) {

        window.location.href = 'index.html';

        return;
    }


    // ==========================================
    // INFORMACIÓN DEL USUARIO
    // ==========================================

    const { data: usuario, error: userError } =
        await supabaseClient
            .from('usuarios_web')
            .select('nombre')
            .eq('id_usuario', user.id)
            .single();


    if (userError) {

        console.error(
            'Error al obtener información del usuario:',
            userError
        );

        patientName.textContent =
            'Usuario: ' + user.email;

    } else {

        patientName.textContent =
            'Usuario: ' + usuario.nombre;

    }
 // ==========================================
// OBTENER PERSONA ASIGNADA AL USUARIO
 // ==========================================

    const { data: acceso, error: accesoError } =
        await supabaseClient
            .from('accesos_usuarios')
            .select('id_persona')
            .eq('id_usuario', user.id)
            .eq('activo', true)
            .single();


    if (accesoError) {

        console.error(
            'Error al obtener el paciente asignado:',
            accesoError
        );

        return;
    }


    const idPersona = acceso.id_persona;
    idPersonaActual = idPersona;
    const { data: paciente, error: pacienteError } =
    await supabaseClient
        .from('personas_monitoreadas')
        .select(`
            nombre_completo,
            fecha_nacimiento,
            telefono,
            correo
        `)
        .eq('id_persona', idPersona)
        .single();

if (pacienteError) {
    console.error(
        'Error al obtener información del paciente:',
        pacienteError
    );
} else {

    document.getElementById('patientFullName').textContent =
        paciente.nombre_completo || '--';

    document.getElementById('patientBirthDate').textContent =
        paciente.fecha_nacimiento
            ? new Date(paciente.fecha_nacimiento + 'T00:00:00')
                .toLocaleDateString('es-MX')
            : '--';

    document.getElementById('patientPhone').textContent =
        paciente.telefono || '--';

    document.getElementById('patientEmail').textContent =
        paciente.correo || '--';

    if (paciente.fecha_nacimiento) {

        const fechaNacimiento =
            new Date(
                paciente.fecha_nacimiento + 'T00:00:00'
            );

        const hoy = new Date();

        let edad =
            hoy.getFullYear() -
            fechaNacimiento.getFullYear();

        const mes =
            hoy.getMonth() -
            fechaNacimiento.getMonth();

        if (
            mes < 0 ||
            (
                mes === 0 &&
                hoy.getDate() < fechaNacimiento.getDate()
            )
        ) {
            edad--;
        }

        document.getElementById('patientAge').textContent =
            edad + ' años';

    } else {

        document.getElementById('patientAge').textContent =
            '--';
    }
}
const { data: contactos, error: contactosError } =
    await supabaseClient
        .from('contactos_emergencia')
        .select(`
            nombre,
            parentesco,
            telefono
        `)
        .eq('id_persona', idPersona);

const emergencyContactsContainer =
    document.getElementById('emergencyContactsContainer');

if (contactosError) {

    console.error(
        'Error al obtener contactos de emergencia:',
        contactosError
    );

    if (emergencyContactsContainer) {
        emergencyContactsContainer.innerHTML = `
            <p>No se pudieron cargar los contactos de emergencia.</p>
        `;
    }

} else if (!contactos || contactos.length === 0) {

    if (emergencyContactsContainer) {
        emergencyContactsContainer.innerHTML = `
            <p>No hay contactos de emergencia registrados.</p>
        `;
    }

} else {

    if (emergencyContactsContainer) {

        emergencyContactsContainer.innerHTML = '';

        contactos.forEach((contacto) => {

            const contactoElement =
                document.createElement('div');

            contactoElement.className =
                'emergency-contact-item';

            contactoElement.innerHTML = `
                <strong>${contacto.nombre}</strong>
                <span>Parentesco: ${contacto.parentesco}</span>
                <span>Teléfono: ${contacto.telefono}</span>
            `;

            emergencyContactsContainer.appendChild(
                contactoElement
            );
        });
    }
}
        // ==========================================
    // OBTENER DISPOSITIVO DEL PACIENTE
    // ==========================================

const { data: dispositivo, error: dispositivoError } =
    await supabaseClient
        .from('dispositivos')
        .select(`
            id_dispositivo,
            nombre,
            modelo,
            identificador
        `)
        .eq('id_persona', idPersona)
        .single();

if (dispositivoError) {

    console.error(
        'Error al obtener información del dispositivo:',
        dispositivoError
    );

    return;
}

const idDispositivo = dispositivo.id_dispositivo;
document.getElementById('deviceName').textContent =
    dispositivo.nombre || '--';

document.getElementById('deviceModel').textContent =
    dispositivo.modelo || '--';

document.getElementById('deviceIdentifier').textContent =
    dispositivo.identificador || '--';

    // ==========================================
// ÚLTIMA MEDICIÓN
// ==========================================

const { data: medicion, error: medicionError } =
    await supabaseClient
        .from('mediciones')
        .select(`
            fecha_hora,
            frecuencia_cardiaca,
            spo2,
            latitud,
            longitud,
            direccion
        `)
        .eq('id_dispositivo', idDispositivo)
        .order('fecha_hora', { ascending: false })
        .limit(1)
        .single();

if (medicionError) {

    console.error(
        'Error al obtener la medición:',
        medicionError
    );

    return;
}
        // ==========================================
    // OBTENER UMBRALES CONFIGURADOS
    // ==========================================

    const { data: umbrales, error: umbralesError } =
        await supabaseClient
            .from('configuracion_umbrales')
            .select(`
                frecuencia_cardiaca_min,
                frecuencia_cardiaca_max,
                spo2_min
            `)
            .eq('id_persona', idPersona)
            .single();


    if (umbralesError) {

        console.error(
            'Error al obtener los umbrales:',
            umbralesError
        );

        return;
    }

    if (minHeartRateInput) {
    minHeartRateInput.value =
        umbrales.frecuencia_cardiaca_min;
}

if (maxHeartRateInput) {
    maxHeartRateInput.value =
        umbrales.frecuencia_cardiaca_max;
}

if (minSpo2Input) {
    minSpo2Input.value =
        umbrales.spo2_min;
}

    // Cargar historial semanal
cargarHistorial(idDispositivo, umbrales);

actualizarEstadoSistema(
    medicion,
    umbrales
);

// Activar actualización en tiempo real
activarTiempoReal(
    idDispositivo,
    umbrales
);

    // ==========================================
    // COMPROBAR FRECUENCIA CARDÍACA
    // ==========================================

    const heartRateStatus =
        document.getElementById('heartRateStatus');

if (
    medicion.frecuencia_cardiaca < umbrales.frecuencia_cardiaca_min ||
    medicion.frecuencia_cardiaca > umbrales.frecuencia_cardiaca_max
) {

    heartRateStatus.textContent =
        '⚠️ Fuera del rango';

    heartRateStatus.className =
        'vital-status alert';

} else {

    heartRateStatus.textContent =
        'Dentro del rango';

    heartRateStatus.className =
        'vital-status normal';

}


    // ==========================================
    // COMPROBAR SpO₂
    // ==========================================

    const spo2Status =
        document.getElementById('spo2Status');

if (medicion.spo2 < umbrales.spo2_min) {

    spo2Status.textContent =
        '⚠️ Nivel bajo';

    spo2Status.className =
        'vital-status alert';

} else {

    spo2Status.textContent =
        'Dentro del rango';

    spo2Status.className =
        'vital-status normal';

}
    // ==========================================
    // MOSTRAR FRECUENCIA CARDÍACA
    // ==========================================

    document.getElementById('heartRateValue').textContent =
        medicion.frecuencia_cardiaca + ' BPM';
        
// ==========================================
// MOSTRAR FECHA Y HORA DE LA ÚLTIMA MEDICIÓN
// ==========================================

const ultimaMedicion =
    new Date(medicion.fecha_hora);

document.getElementById('lastMeasurementTime').textContent =
    'Última medición: ' +
    ultimaMedicion.toLocaleString('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    // ==========================================
    // MOSTRAR SpO₂
    // ==========================================

    document.getElementById('spo2Value').textContent =
        medicion.spo2 + ' %';


// ==========================================
// MOSTRAR UBICACIÓN
// ==========================================

const locationValue =
    document.getElementById('locationValue');

const locationButton =
    document.getElementById('locationButton');


if (
    medicion.latitud !== null &&
    medicion.longitud !== null
) {

    // Mostrar coordenadas
    locationValue.textContent =
        medicion.latitud + ', ' + medicion.longitud;


    // Crear enlace hacia Google Maps
    locationButton.href =
        'https://www.google.com/maps?q=' +
        medicion.latitud + ',' +
        medicion.longitud;

} else {

    locationValue.textContent =
        'Sin ubicación';

    locationButton.style.display =
        'none';

}

}


// ==========================================
// CERRAR SESIÓN
// ==========================================

if (logoutButton) {

    logoutButton.addEventListener('click', async () => {

        const { error } =
            await supabaseClient.auth.signOut();


        if (!error) {

            window.location.href = 'index.html';

        }

    });

}
// ==========================================
// ACTUALIZACIÓN EN TIEMPO REAL
// ==========================================

function activarTiempoReal(idDispositivo, umbrales) {

    supabaseClient
        .channel('mediciones-tiempo-real')

        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'mediciones',
                filter: 'id_dispositivo=eq.' + idDispositivo
            },
            (payload) => {

                console.log(
                    'Nueva medición recibida:',
                    payload.new
                );

                const medicion = payload.new;
                actualizarEstadoSistema(
    medicion,
    umbrales
);


                // ==========================================
                // ACTUALIZAR BPM
                // ==========================================

                document.getElementById(
                    'heartRateValue'
                ).textContent =
                    medicion.frecuencia_cardiaca + ' BPM';


                // ==========================================
                // ACTUALIZAR ESTADO BPM
                // ==========================================

                const heartRateStatus =
                    document.getElementById(
                        'heartRateStatus'
                    );


                if (
                    medicion.frecuencia_cardiaca <
                        umbrales.frecuencia_cardiaca_min ||
                    medicion.frecuencia_cardiaca >
                        umbrales.frecuencia_cardiaca_max
                ) {

                    heartRateStatus.textContent =
                        '⚠️ Fuera del rango';
                        heartRateStatus.className =
    'vital-status alert';

                } else {

                    heartRateStatus.textContent =
                        'Dentro del rango';
                        heartRateStatus.className =
    'vital-status normal';

                }


                // ==========================================
                // ACTUALIZAR SpO₂
                // ==========================================

                document.getElementById(
                    'spo2Value'
                ).textContent =
                    medicion.spo2 + ' %';


                // ==========================================
                // ACTUALIZAR ESTADO SpO₂
                // ==========================================

                const spo2Status =
                    document.getElementById(
                        'spo2Status'
                    );


                if (medicion.spo2 < umbrales.spo2_min) {

                    spo2Status.textContent =
                        '⚠️ Nivel bajo';
                        spo2Status.className =
    'vital-status alert';

                } else {

                    spo2Status.textContent =
                        'Dentro del rango';
                        spo2Status.className =
    'vital-status normal';

                }


                // ==========================================
                // ACTUALIZAR FECHA Y HORA
                // ==========================================

                const ultimaMedicion =
                    new Date(medicion.fecha_hora);


                document.getElementById(
                    'lastMeasurementTime'
                ).textContent =
                    'Última medición: ' +
                    ultimaMedicion.toLocaleString(
                        'es-MX',
                        {
                            dateStyle: 'short',
                            timeStyle: 'short'
                        }
                    );


                // ==========================================
                // ACTUALIZAR UBICACIÓN
                // ==========================================

                const locationValue =
                    document.getElementById(
                        'locationValue'
                    );

                const locationButton =
                    document.getElementById(
                        'locationButton'
                    );


                if (
                    medicion.latitud !== null &&
                    medicion.longitud !== null
                ) {

                    locationValue.textContent =
                        medicion.latitud +
                        ', ' +
                        medicion.longitud;


                    locationButton.href =
                        'https://www.google.com/maps?q=' +
                        medicion.latitud +
                        ',' +
                        medicion.longitud;


                    locationButton.style.display =
                        'inline-block';

                } else {

                    locationValue.textContent =
                        'Sin ubicación';

                    locationButton.style.display =
                        'none';

                }


                // ==========================================
                // ACTUALIZAR HISTORIAL
                // ==========================================

                cargarHistorial(
                    idDispositivo,
                    umbrales
                );

            }
        )

        .subscribe((status) => {

            console.log(
                'Estado de Realtime:',
                status
            );

        });

}
// ==========================================
// ESTADO GENERAL DEL SISTEMA
// ==========================================

function actualizarEstadoSistema(medicion, umbrales) {

    const systemStatusCard =
        document.getElementById('systemStatusCard');

    const systemStatusTitle =
        document.getElementById('systemStatusTitle');

    const systemStatusMessage =
        document.getElementById('systemStatusMessage');


    if (
        !systemStatusCard ||
        !systemStatusTitle ||
        !systemStatusMessage
    ) {
        return;
    }


    const frecuenciaFuera =
        medicion.frecuencia_cardiaca <
            umbrales.frecuencia_cardiaca_min ||
        medicion.frecuencia_cardiaca >
            umbrales.frecuencia_cardiaca_max;


    const spo2Fuera =
        medicion.spo2 <
        umbrales.spo2_min;


    const hayAlerta =
        frecuenciaFuera || spo2Fuera;


    if (hayAlerta) {

        systemStatusCard.className =
            'system-status-card alert';

        systemStatusTitle.textContent =
            '🔴 Atención requerida';

        systemStatusMessage.textContent =
            'Se detectaron valores fuera de los umbrales configurados.';

    } else {

        systemStatusCard.className =
            'system-status-card normal';

        systemStatusTitle.textContent =
            '🟢 Sistema funcionando correctamente';

        systemStatusMessage.textContent =
            'Los signos vitales se encuentran dentro de los parámetros configurados.';

    }

}
async function guardarUmbrales() {
    if (!idPersonaActual) {
        settingsMessage.textContent =
            'No se identificó al paciente.';
        return;
    }

    const bpmMin = Number(minHeartRateInput.value);
    const bpmMax = Number(maxHeartRateInput.value);
    const spo2Min = Number(minSpo2Input.value);

    if (
        !Number.isFinite(bpmMin) ||
        !Number.isFinite(bpmMax) ||
        !Number.isFinite(spo2Min)
    ) {
        settingsMessage.textContent =
            'Ingresa valores numéricos válidos.';
        return;
    }

    if (bpmMin >= bpmMax) {
        settingsMessage.textContent =
            'El BPM mínimo debe ser menor que el BPM máximo.';
        return;
    }

    if (
        bpmMin < 30 ||
        bpmMax > 200 ||
        spo2Min < 50 ||
        spo2Min > 100
    ) {
        settingsMessage.textContent =
            'Verifica que los valores estén dentro de los rangos permitidos.';
        return;
    }

    saveThresholdsButton.disabled = true;
    settingsMessage.textContent =
        'Guardando configuración...';

    const { error } = await supabaseClient
        .from('configuracion_umbrales')
        .update({
            frecuencia_cardiaca_min: bpmMin,
            frecuencia_cardiaca_max: bpmMax,
            spo2_min: spo2Min
        })
        .eq('id_persona', idPersonaActual);

    if (error) {
        console.error(
            'Error al guardar los umbrales:',
            error
        );

        settingsMessage.textContent =
            'No se pudo guardar la configuración.';
    } else {
        settingsMessage.textContent =
            'Configuración guardada correctamente.';
    }

    saveThresholdsButton.disabled = false;
}
if (saveThresholdsButton) {
    saveThresholdsButton.addEventListener(
        'click',
        guardarUmbrales
    );
}
