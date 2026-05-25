// ============================================================
//  ZONA DE CONFIGURACIÓN — AQUÍ ES DONDE DEBEN HACER CAMBIOS
// ============================================================

// 1. Pega el link de tu modelo de Teachable Machine
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/uXB-cRA2B/";

// 2. Título y subtítulo que aparece en la página
const TITULO    = "Clasificador de Filosofos de la Filosofía Moderna";
const SUBTITULO = "Immanuel Kant · Rene Descartes · David Hume · John Locke";

// 3. Información de cada clase que entrenaste en Teachable Machine
//    - El nombre entre comillas debe ser EXACTAMENTE igual al nombre de la clase en tu modelo
//    - "label" es el nombre bonito que se muestra al detectar
//    - "curiosities" son los datos o curiosidades que aparecen al reconocer (mínimo 1, máximo los que quieras)
const DATOS = {

    "Immanuel Kant": {
        label: "Immanuel Kant",
        curiosities: [
            "Su obsesiva rutina y su ciudad natal (Königsberg).",
            "Mundialmente conocido por su compleja obra y su rigurosa vida,.",
            "La mitad de sus más de 70 publicaciones trataban sobre ciencias naturales.",
        ]
    },

    "Rene Descartes": {
        label: "Rene Descartes",
        curiosities: [
            "Su icónico postulado (Pienso, luego existo) fue publicado originalmente en francés como Je pense, donc je suis en el Discurso del Método de 1637.",
            "Él mismo afirmaba haber recibido la inspiración inicial a través de una serie de tres sueños reveladores durante una noche de invierno.",
            "Tras su fallecimiento, sus restos fueron trasladados a Francia. Sin embargo, su cráneo desapareció en el proceso y estuvo perdido durante años.",
        ]
    },

    "David Hume": {
        label: "David Hume",
        curiosities: [
            "Su obra más importante, el Tratado de la naturaleza humana, fue un rotundo fracaso de ventas y pasó desapercibida cuando se publicó.",
            "A pesar de su intensa vida intelectual, una de sus grandes aficiones era el whist (un juego de cartas).",
            "Enfrentó su propia muerte con una calma imperturbable.",
        ]
    },
    

    "John Locke": {
        label: "John Locke",
        curiosities: [
            "Antes de la filosofía, trabajó como secretario político y redactó los Fundamental Constitutions of Carolina.",
            "En 1697, propuso ante el gobierno británico que los niños pobres mayores de tres años fueran puestos a trabajar en escuelas manufactureras.",
            "Tuvo que camuflarse y publicó muchas de sus obras revolucionarias de forma totalmente anónima.",
        ]
    }

};

// 4. Segundos que espera la cámara antes de poder mostrar un resultado
//    (sirve para que tenga tiempo de enfocarse bien antes de decidir)
const SEGUNDOS_ESPERA = 3;

// 5. Porcentaje mínimo de confianza para que la cámara muestre un resultado
//    (85 significa que el modelo debe estar 85% seguro antes de mostrar el resultado)
const CONFIANZA_MINIMA = 85;

// ============================================================
//  CÓDIGO DEL PROGRAMA — NO ES NECESARIO MODIFICAR ABAJO
// ============================================================

// Variables internas
let model, webcam;
let camaraActiva  = false;
let camaraBloqueada = false;
let tiempoInicio  = null;
let modoActual    = 'cam';

// Aplicar título y subtítulo al cargar la página
document.getElementById('page-title').textContent    = TITULO;
document.getElementById('page-subtitle').textContent = SUBTITULO;

// ------- CAMBIO DE MODO (Cámara / Imagen) -------

function switchMode(modo) {
    modoActual = modo;

    document.getElementById('tab-cam').classList.toggle('active',  modo === 'cam');
    document.getElementById('tab-file').classList.toggle('active', modo === 'file');
    document.getElementById('mode-cam').classList.toggle('active',  modo === 'cam');
    document.getElementById('mode-file').classList.toggle('active', modo === 'file');

    if (modo === 'file' && camaraActiva && webcam) detenerCamara();

    resetearTodo();
}

// ------- CÁMARA -------

async function initCamera() {
    document.getElementById('start-btn').classList.add('hidden');
    document.getElementById('loading-msg').classList.remove('hidden');

    if (!model) await cargarModelo();

    webcam = new tmImage.Webcam(320, 320, true); // true = espejo
    await webcam.setup();
    await webcam.play();

    camaraActiva    = true;
    camaraBloqueada = false;
    tiempoInicio    = Date.now();

    // Insertar el video de la cámara en la página
    const wrap = document.getElementById('camera-wrap');
    document.getElementById('cam-placeholder').remove();
    wrap.insertBefore(webcam.canvas, wrap.firstChild);

    document.getElementById('scan-line').classList.add('active');
    document.getElementById('loading-msg').classList.add('hidden');
    document.getElementById('results-card').classList.remove('hidden');

    bucle();
}

async function bucle() {
    if (!camaraActiva || camaraBloqueada) return;
    webcam.update();
    await predecirCamara(webcam.canvas);
    requestAnimationFrame(bucle);
}

function detenerCamara() {
    camaraActiva = false;
    if (webcam) webcam.stop();
    document.getElementById('scan-line').classList.remove('active');
}

// ------- SUBIR IMAGEN -------

function handleFile(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const reader = new FileReader();
    reader.onload = ev => {
        const img = document.getElementById('preview-img');
        img.src = ev.target.result;
        img.onload = () => {
            document.getElementById('upload-area').classList.add('hidden');
            document.getElementById('preview-wrap').classList.remove('hidden');
            document.getElementById('analyze-btn').classList.remove('hidden');
            document.getElementById('clear-btn').classList.remove('hidden');
        };
    };
    reader.readAsDataURL(archivo);
}

function clearImage() {
    document.getElementById('upload-area').classList.remove('hidden');
    document.getElementById('preview-wrap').classList.add('hidden');
    document.getElementById('analyze-btn').classList.add('hidden');
    document.getElementById('clear-btn').classList.add('hidden');
    document.getElementById('file-input').value = '';
    resetearTodo();
}

async function predictFromImage() {
    document.getElementById('loading-msg').classList.remove('hidden');
    document.getElementById('analyze-btn').classList.add('hidden');

    if (!model) await cargarModelo();

    // Dibujar la imagen en un canvas 224x224 (tamaño que espera el modelo)
    const img    = document.getElementById('preview-img');
    const canvas = document.createElement('canvas');
    canvas.width  = 224;
    canvas.height = 224;
    canvas.getContext('2d').drawImage(img, 0, 0, 224, 224);

    document.getElementById('results-card').classList.remove('hidden');

    const predicciones = await model.predict(canvas);
    mostrarBarras(predicciones);

    const mejor = predicciones.reduce((a, b) => a.probability > b.probability ? a : b);

    document.getElementById('loading-msg').classList.add('hidden');

    if (DATOS[mejor.className]) {
        mostrarResultado(mejor.className, mejor.probability);
    } else {
        mostrarDesconocido();
    }
}

// ------- PREDICCIÓN EN VIVO (cámara) -------

async function predecirCamara(fuente) {
    const predicciones = await model.predict(fuente);
    mostrarBarras(predicciones);

    const mejor = predicciones.reduce((a, b) => a.probability > b.probability ? a : b);

    const tiempoSuficiente = (Date.now() - tiempoInicio) >= (SEGUNDOS_ESPERA * 1000);
    const esConocido       = DATOS[mejor.className] !== undefined;
    const confianzaAlta    = (mejor.probability * 100) >= CONFIANZA_MINIMA;

    // Solo mostrar resultado si pasaron los segundos de espera,
    // la clase es conocida y la confianza supera el mínimo
    if (tiempoSuficiente && esConocido && confianzaAlta) {
        camaraBloqueada = true;
        detenerCamara();
        mostrarResultado(mejor.className, mejor.probability);
    }
}

// ------- BARRAS DE PROBABILIDAD -------

function mostrarBarras(predicciones) {
    const contenedor = document.getElementById('bars-container');
    contenedor.innerHTML = '';

    const mejor = predicciones.reduce((a, b) => a.probability > b.probability ? a : b);

    predicciones.forEach(p => {
        const porcentaje = (p.probability * 100).toFixed(0);
        const esMejor    = p.className === mejor.className;

        const item = document.createElement('div');
        item.className = 'prob-item';
        item.innerHTML = `
            <div class="prob-header">
                <span class="label">${p.className}</span>
                <span class="pct">${porcentaje}%</span>
            </div>
            <div class="bar-bg">
                <div class="bar-fill ${esMejor ? 'top' : ''}" style="width:${porcentaje}%"></div>
            </div>`;
        contenedor.appendChild(item);
    });
}

// ------- MOSTRAR RESULTADO FINAL -------

function mostrarResultado(clase, probabilidad) {
    const datos = DATOS[clase];
    const conf  = (probabilidad * 100).toFixed(0);

    document.getElementById('results-card').classList.add('hidden');

    document.getElementById('result-name').textContent       = datos.label;
    document.getElementById('result-confidence').textContent = `Confianza: ${conf}%`;

    // Construir lista de curiosidades
    const lista = document.getElementById('curiosities');
    lista.innerHTML = datos.curiosities.map(c => `<li>${c}</li>`).join('');

    document.getElementById('result-known').classList.remove('hidden');
    document.getElementById('result-unknown').classList.add('hidden');
    document.getElementById('result-final').classList.remove('hidden');
}

function mostrarDesconocido() {
    document.getElementById('results-card').classList.add('hidden');
    document.getElementById('result-known').classList.add('hidden');
    document.getElementById('result-unknown').classList.remove('hidden');
    document.getElementById('result-final').classList.remove('hidden');
}

// ------- VOLVER A DETECTAR -------

async function resetDetection() {
    camaraBloqueada = false;
    camaraActiva    = false;

    document.getElementById('result-final').classList.add('hidden');
    document.getElementById('results-card').classList.add('hidden');
    document.getElementById('bars-container').innerHTML = '';

    if (modoActual === 'cam') {
        // Destruir la cámara anterior y crear una nueva
        if (webcam) {
            try { webcam.stop(); } catch(e) {}
            webcam = null;
        }

        const wrap      = document.getElementById('camera-wrap');
        const oldCanvas = wrap.querySelector('canvas');
        if (oldCanvas) oldCanvas.remove();

        document.getElementById('loading-msg').classList.remove('hidden');

        webcam = new tmImage.Webcam(320, 320, true);
        await webcam.setup();
        await webcam.play();

        camaraActiva    = true;
        camaraBloqueada = false;
        tiempoInicio    = Date.now();

        wrap.insertBefore(webcam.canvas, wrap.firstChild);
        document.getElementById('scan-line').classList.add('active');
        document.getElementById('loading-msg').classList.add('hidden');
        document.getElementById('results-card').classList.remove('hidden');

        bucle();
    } else {
        clearImage();
    }
}

// ------- RESET COMPLETO -------

function resetearTodo() {
    camaraBloqueada = false;
    document.getElementById('result-final').classList.add('hidden');
    document.getElementById('results-card').classList.add('hidden');
    document.getElementById('bars-container').innerHTML = '';
    document.getElementById('loading-msg').classList.add('hidden');
}

// ------- CARGAR MODELO -------

async function cargarModelo() {
    model = await tmImage.load(MODEL_URL + "model.json", MODEL_URL + "metadata.json");
}

// ------- DRAG & DROP en la zona de subir imagen -------

document.addEventListener('DOMContentLoaded', () => {
    const area = document.getElementById('upload-area');

    area.addEventListener('dragover', e => {
        e.preventDefault();
        area.style.borderColor = '#999';
    });

    area.addEventListener('dragleave', () => {
        area.style.borderColor = '';
    });

    area.addEventListener('drop', e => {
        e.preventDefault();
        area.style.borderColor = '';
        const archivo = e.dataTransfer.files[0];
        if (archivo && archivo.type.startsWith('image/')) {
            const dt = new DataTransfer();
            dt.items.add(archivo);
            document.getElementById('file-input').files = dt.files;
            handleFile({ target: { files: [archivo] } });
        }
    });
});
