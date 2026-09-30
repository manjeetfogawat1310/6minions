// js/three-setup.js

// 1. Scene, Camera, aur Renderer Setup
const scene = new THREE.Scene();
// Background color (light blue to match your theme)
scene.background = new THREE.Color(0xeaf2f8); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 30;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('three-bg').appendChild(renderer.domElement);

// 2. Lighting Setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffc72c, 1); // Golden light
pointLight.position.set(10, 10, 10);
scene.add(pointLight);

// 3. 3D Objects (Honeycombs / Hexagons) Create karna
const hexagons = [];
// CylinderGeometry with 6 radial segments creates a perfect 3D hexagon
const geometry = new THREE.CylinderGeometry(2, 2, 0.5, 6); 
const material = new THREE.MeshStandardMaterial({ 
    color: 0xffc72c, 
    metalness: 0.3,
    roughness: 0.4
});

// Create 30 random hexagons
for (let i = 0; i < 30; i++) {
    const hex = new THREE.Mesh(geometry, material);
    
    // Random positions across the screen
    hex.position.x = (Math.random() - 0.5) * 60;
    hex.position.y = (Math.random() - 0.5) * 60;
    hex.position.z = (Math.random() - 0.5) * 40 - 10;
    
    // Random rotations
    hex.rotation.x = Math.random() * Math.PI;
    hex.rotation.y = Math.random() * Math.PI;
    
    // Custom properties for animation
    hex.userData = {
        rotationSpeedX: (Math.random() - 0.5) * 0.02,
        rotationSpeedY: (Math.random() - 0.5) * 0.02,
        floatSpeed: Math.random() * 0.05 + 0.02
    };
    
    scene.add(hex);
    hexagons.push(hex);
}

// 4. Animation Loop
function animate() {
    requestAnimationFrame(animate);
    
    hexagons.forEach(hex => {
        // Rotate objects
        hex.rotation.x += hex.userData.rotationSpeedX;
        hex.rotation.y += hex.userData.rotationSpeedY;
        
        // Float upwards
        hex.position.y += hex.userData.floatSpeed;
        
        // Reset position if it goes too high
        if (hex.position.y > 30) {
            hex.position.y = -30;
            hex.position.x = (Math.random() - 0.5) * 60;
        }
    });
    
    renderer.render(scene, camera);
}
animate();

// 5. Handle Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});