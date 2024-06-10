// variables globales para la escena, camara y renderizador de three.js
let scene, camera, renderer;

// variables para el audio y su analizador
let audio, audioLoader, audioAnalyser;

// arreglo para almacenar las particulas y sus velocidades
let particles = [];
let velocities = [];

// limites de la escena para las particulas
const bounds = { x: 250, y: 150, z: 250 };

// variables para controlar el estado de reproduccion del audio
let isPlaying = false;
let isPaused = false;
let audioRange; // rango del control de progreso del audio
let audioSelect; // selector para cambiar el archivo de audio

// nueva variable para controlar el estado del contexto de audio
let contextStarted = false;

// canvas y contexto para el histograma
let histogramCanvas, histogramCtx;

// variable para el modo 3D
let is3DMode = false;

// llamamos a la funcion init() y configuramos los eventos de los botones
init();

// configuramos los eventos de los botones de control
document.getElementById('startButton').addEventListener('click', function() {
    if (!contextStarted) {
        const audioContext = THREE.AudioContext.getContext();
        audioContext.resume().then(() => {
            contextStarted = true; // actualizar el estado del contexto de audio
            startAudio();
        });
    } else {
        startAudio();
    }
});

document.getElementById('pauseButton').addEventListener('click', function() {
    if (isPlaying && !isPaused) {
        audio.pause();
        isPaused = true;
    }
});

document.getElementById('backwardButton').addEventListener('click', function() {
    if (audio.buffer) {
        audio.currentTime = Math.max(audio.currentTime - 10, 0);
    }
});

document.getElementById('forwardButton').addEventListener('click', function() {
    if (audio.buffer) {
        audio.currentTime = Math.min(audio.currentTime + 10, audio.buffer.duration);
    }
});

document.getElementById('masvel').addEventListener('click', function() {
    audio.playbackRate += 1;
});

document.getElementById('menosvel').addEventListener('click', function() {
    if (audio.playbackRate > 1) {
        audio.playbackRate -= 1;
    } else {
        audio.playbackRate = 1;
    }
});

audioRange = document.getElementById('audioRange');
audioRange.addEventListener('input', function() {
    if (audio.buffer) {
        const seekTime = audio.buffer.duration * (audioRange.value / 100);
        audio.currentTime = seekTime;
    }
});

audioSelect = document.getElementById('audioSelect');
audioSelect.addEventListener('change', function() {
    const selectedAudio = audioSelect.value;
    loadAudio(selectedAudio);
});

// configuracion de los eventos de los nuevos botones
document.getElementById('backgroundColorButton').addEventListener('click', changeBackgroundColor);
document.getElementById('increaseParticleSizeButton').addEventListener('click', increaseParticleSize);
document.getElementById('decreaseParticleSizeButton').addEventListener('click', decreaseParticleSize);
document.getElementById('increaseSensitivityButton').addEventListener('click', increaseSensitivity);
document.getElementById('decreaseSensitivityButton').addEventListener('click', decreaseSensitivity);
document.getElementById('toggle3DButton').addEventListener('click', toggle3DMode);

// funcion init para inicializar la escena y configurar el audio
function init() {
    // inicializamos la escena de three.js
    scene = new THREE.Scene();

    // inicializamos la camara con un campo de vision de 75 grados
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / (window.innerHeight / 2), 0.1, 1000);
    camera.position.z = 300; // posicionamos la camara en el eje z

    // inicializamos el renderizador y lo vinculamos al canvas de visualizacion
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('visualizer') });
    renderer.setSize(window.innerWidth, window.innerHeight / 2); // ajustamos el tamaño del renderizador

    // creamos el listener de audio y el objeto de audio
    const audioListener = new THREE.AudioListener();
    audio = new THREE.Audio(audioListener);

    // inicializamos el cargador de audio y cargamos el primer archivo
    audioLoader = new THREE.AudioLoader();
    loadAudio('audio.mp3');

    // creamos el analizador de audio con 128 frecuencias
    audioAnalyser = new THREE.AudioAnalyser(audio, 128);

    // inicializamos las particulas en la escena
    const particleGeometry = new THREE.SphereGeometry(20, 32, 32);
    const separation = window.innerWidth / 128; // distancia entre particulas
    for (let i = 0; i < 128; i++) {
        // usamos LineSegments para que las particulas se vean como esferas hechas de lineas
        const particleMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        const particle = new THREE.LineSegments(new THREE.EdgesGeometry(particleGeometry), particleMaterial);
        particle.position.x = (i - 64) * separation; // posicionamos las particulas en el eje x
        particles.push(particle);
        velocities.push(new THREE.Vector3(0, 0, 0)); // inicializamos las velocidades a 0
        scene.add(particle); // agregamos las particulas a la escena
    }

    // configuramos el evento para detener la reproduccion del audio cuando termine
    audio.addEventListener('ended', function() {
        isPlaying = false;
        isPaused = false;
    });

    // inicializamos el canvas para el histograma
    histogramCanvas = document.getElementById('histogram');
    histogramCtx = histogramCanvas.getContext('2d');
    histogramCanvas.width = window.innerWidth; // ajustamos el ancho del canvas
    histogramCanvas.height = window.innerHeight / 2; // ajustamos el alto del canvas
}

// funcion para cargar un archivo de audio
function loadAudio(file) {
    audioLoader.load(file, function(buffer) {
        audio.setBuffer(buffer);
        audio.setLoop(true); // configuramos el audio para que se repita en bucle
        if (isPlaying) {
            audio.play(); // reproducimos el audio si ya esta en estado de reproduccion
        }
    });
}

// funcion para iniciar o reanudar la reproduccion del audio
function startAudio() {
    if (!isPlaying) {
        audio.play();
        isPlaying = true;
        isPaused = false;
        animate(); // iniciamos la animacion de la visualizacion
    } else if (isPlaying && isPaused) {
        audio.play();
        isPaused = false;
    }
}

// funcion para animar las particulas y el histograma
function animate() {
    requestAnimationFrame(animate);

    // obtenemos los datos de frecuencia del analizador de audio
    const data = audioAnalyser.getFrequencyData();

    // animamos las particulas segun los datos de frecuencia
    const separation = window.innerWidth / 128;
    for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        const hue = (i / data.length) * 360;
        const color = new THREE.Color(`hsl(${hue}, 100%, 50%)`);
        particle.material.color = color;
        particle.material.needsUpdate = true;

        const scale = data[i] / 256; // calculamos la escala de la particula segun la frecuencia
        particle.scale.set(scale, scale, scale); // ajustamos la escala de la particula

        // agregamos rebotes y colisiones
        const velocity = velocities[i];
        velocity.y -= 0.01 * scale; // aplicamos una gravedad proporcional a la escala
        particle.position.add(velocity);

        // verificamos colisiones con los limites y rebotamos
        if (particle.position.y < -bounds.y / 2 || particle.position.y > bounds.y / 2) {
            velocity.y = -velocity.y;
        }
        if (particle.position.x < -bounds.x / 2 || particle.position.x > bounds.x / 2) {
            velocity.x = -velocity.x;
        }
        if (particle.position.z < -bounds.z / 2 || particle.position.z > bounds.z / 2) {
            velocity.z = -velocity.z;
        }
    }

    // renderizamos la escena
    renderer.render(scene, camera);

    // actualizamos el progreso del audio en el rango
    if (audio.buffer) {
        const progress = (audio.currentTime / audio.buffer.duration) * 100;
        audioRange.value = progress;
    }

    // dibujamos el histograma usando la nueva funcion
    drawHistogram(data);
}

// funcion para dibujar el histograma
function drawHistogram(data) {
    histogramCtx.clearRect(0, 0, histogramCanvas.width, histogramCanvas.height); // limpiamos el canvas
    const barWidth = histogramCanvas.width / data.length; // ancho de cada barra
    for (let i = 0; i < data.length; i++) {
        const value = data[i];
        const percent = value / 256; // calculamos el porcentaje de la magnitud
        const height = histogramCanvas.height * percent; // calculamos la altura de la barra
        const offset = histogramCanvas.height - height - 1; // calculamos el desplazamiento de la barra
        const hue = i / data.length * 360; // calculamos el tono del color
        histogramCtx.fillStyle = `hsl(${hue}, 100%, 50%)`; // asignamos el color
        histogramCtx.fillRect(i * barWidth, offset, barWidth, height); // dibujamos la barra

        // dibujamos las escalas de frecuencia y magnitud
        histogramCtx.fillStyle = "#ffffff";
        histogramCtx.font = "10px Arial";
        if (i % 16 === 0) {
            histogramCtx.fillText(((i / data.length) * audio.context.sampleRate / 2).toFixed(0) + ' Hz', i * barWidth, histogramCanvas.height - 5);
        }
    }

    // dibujamos las lineas de las escalas en el histograma
    for (let i = 0; i <= 10; i++) {
        const y = (histogramCanvas.height / 10) * i;
        histogramCtx.fillText((i * 256 / 10).toFixed(0), 5, histogramCanvas.height - y);
        histogramCtx.moveTo(0, y);
        histogramCtx.lineTo(histogramCanvas.width, y);
        histogramCtx.strokeStyle = "#ffffff";
        histogramCtx.stroke();
    }
}

// funciones para cambiar el color de fondo
function changeBackgroundColor() {
    document.body.style.backgroundColor = `hsl(${Math.random() * 360}, 50%, 15%)`;
}

// funciones para aumentar y reducir el tamaño de las particulas
function increaseParticleSize() {
    particles.forEach(particle => {
        particle.scale.multiplyScalar(1.2);
    });
}

function decreaseParticleSize() {
    particles.forEach(particle => {
        particle.scale.multiplyScalar(0.8);
    });
}

// funciones para aumentar y reducir la sensibilidad del analizador de audio
function increaseSensitivity() {
    audioAnalyser.fftSize = Math.min(audioAnalyser.fftSize * 2, 32768);
}

function decreaseSensitivity() {
    audioAnalyser.fftSize = Math.max(audioAnalyser.fftSize / 2, 32);
}

// funcion para alternar el modo 3D
function toggle3DMode() {
    is3DMode = !is3DMode;
    if (is3DMode) {
        camera.position.z = 500;
    } else {
        camera.position.z = 300;
    }
    camera.updateProjectionMatrix();
}
