import * as THREE from "../js/three.module.js";
import {
	OrbitControls
} from "../js/OrbitControls.js";
import {
	TransformControls
} from "../js/TransformControls.js";
import {
	TeapotBufferGeometry
} from "../js/TeapotBufferGeometry.js";
import {
	GUI
} from "../js/dat.gui.module.js";
import {
	GLTFLoader
} from '../js/GLTFLoader.js';
import {
	EffectComposer
} from '../js/EffectComposer.js';
import {
	RenderPass
} from '../js/RenderPass.js';
import {
	AfterimagePass
} from '../js/AfterimagePass.js';
import {
	Water
} from '../js/Water.js';
import {
	Sky
} from '../js/Sky.js';

var cameraPersp, currentCamera;
var scene, renderer, control, orbit, gui, texture, raycaster, Grid;
var meshPlane, pointLight, pointLightHelper, hemiLight, pointLightColorGUI, ObjColorGUI;
var textureLoader = new THREE.TextureLoader(),
	mouse = new THREE.Vector2();
var LightSwitch = false,
	type = null,
	pre_material = null;
var animationID;
var composer, afterimagePass, isPostProcessing = false;
var water, sun, sky;

// A bunch of shapes
var BoxGeometry = new THREE.BoxGeometry(50, 50, 50, 20, 20, 20);
var SphereGeometry = new THREE.SphereGeometry(30, 50, 50);
var ConeGeometry = new THREE.ConeGeometry(30, 70, 50, 20);
var CylinderGeometry = new THREE.CylinderGeometry(30, 30, 70, 50, 20);
var TorusGeometry = new THREE.TorusGeometry(20, 5, 20, 100);
var TorusKnotGeometry = new THREE.TorusKnotGeometry(40, 10, 70, 10);
var TeapotGeometry = new TeapotBufferGeometry(20, 8);
var TetrahedronGeometry = new THREE.TetrahedronGeometry(30);
var OctahedronGeometry = new THREE.OctahedronGeometry(30);
var DodecahedronGeometry = new THREE.DodecahedronGeometry(30);
var IcosahedronGeometry = new THREE.IcosahedronGeometry(30);

// Material
var BasicMaterial = new THREE.MeshBasicMaterial({
	color: "#F5F5F5",
	side: THREE.DoubleSide,
	transparent: true
});
var PointMaterial = new THREE.PointsMaterial({
	color: "#F5F5F5",
	sizeAttenuation: false,
	size: 2,
});
var PhongMaterial = new THREE.MeshPhongMaterial({
	color: "#F5F5F5",
	side: THREE.DoubleSide,
	transparent: true
});

// Main objects on scene
var mesh = new THREE.Mesh();
var point = new THREE.Points();

// Some colors that will use
var color_343A40 = new THREE.Color("#343A40");
var fog_343A40 = new THREE.Fog(color_343A40, 0.5, 3000),
	fog_634A44 = new THREE.Fog("#634A44", 0.5, 3000);

//  Class for GUI control
class ColorGUIHelper {
	constructor(object, prop) {
		this.object = object;
		this.prop = prop;
	}
	get value() {
		return `#${this.object[this.prop].getHexString()}`;
	}
	set value(hexString) {
		this.object[this.prop].set(hexString);
		render();
	}
}

class MinMaxGUIHelper {
	constructor(object, minprop, maxprop) {
		this.object = object;
		this.minprop = minprop;
		this.maxprop = maxprop;
	}
	get min() {
		return this.object[this.minprop];
	}
	set min(v) {
		this.object[this.minprop] = v;
	}
	get max() {
		return this.object[this.maxprop];
	}
	set max(v) {
		this.object[this.maxprop] = v;
	}
}

init();
render();

function init() {
	// Scene
	scene = new THREE.Scene();
	scene.background = color_343A40;

	// Grid
	const planeSize = 5000;
	Grid = new THREE.GridHelper(planeSize, 50, "#A3BAC3", "#A3BAC3");
	scene.add(Grid);

	// Coordinate axes
	// const Axes = new THREE.AxesHelper(30);
	// scene.add(Axes);

	// Fog
	scene.fog = fog_343A40;

	// GUI control
	{
		gui = new GUI({
			autoPlace: false
		});
		let customContainer = document.getElementById("my-gui-container");
		customContainer.appendChild(gui.domElement);
	}

	// Camera
	{
		const fov = 75;
		const aspectRatio = window.innerWidth / window.innerHeight;
		const near = 0.1;
		const far = 5000;
		cameraPersp = new THREE.PerspectiveCamera(fov, aspectRatio, near, far);
		currentCamera = cameraPersp;
		currentCamera.position.set(1, 50, 100);
		currentCamera.lookAt(0, 0, 0);

		const folderCam = gui.addFolder("Camera");
		folderCam.open();
		folderCam.add(currentCamera, "fov", 1, 180).name("FOV").onChange(updateCamera);
		const minMaxGUIHelper = new MinMaxGUIHelper(currentCamera, "near", "far");
		folderCam.add(minMaxGUIHelper, "min", 0.1, 100, 0.1).name("Near").onChange(updateCamera);
		folderCam.add(minMaxGUIHelper, "max", 200, 6000, 10).name("Far").onChange(updateCamera);
	}

	ObjColorGUI = gui.addColor(new ColorGUIHelper(mesh.material, "color"), "value").name("Obj Color");

	raycaster = new THREE.Raycaster();

	// Render
	{
		renderer = new THREE.WebGLRenderer({
			antialias: true,
			logarithmicDepthBuffer: true
		});
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		document.getElementById("rendering").appendChild(renderer.domElement);
	}

	// Check when the browser size has changed and adjust the camera accordingly
	window.addEventListener("resize", function () {
		const WIDTH = window.innerWidth;
		const HEIGHT = window.innerHeight;

		currentCamera.aspect = WIDTH / HEIGHT;
		currentCamera.updateProjectionMatrix();

		renderer.setSize(WIDTH, HEIGHT);
		composer.setSize(WIDTH, HEIGHT);

		render();
	});

	{
		orbit = new OrbitControls(currentCamera, renderer.domElement);
		orbit.update();
		orbit.addEventListener("change", render);

		control = new TransformControls(currentCamera, renderer.domElement);
		control.addEventListener("change", render);

		control.addEventListener("dragging-changed", function (event) {
			orbit.enabled = !event.value;
		});
	}

	// Init plane for showing shadow
	const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
	const planeMat = new THREE.MeshPhongMaterial({
		side: THREE.DoubleSide,
	});

	{
		meshPlane = new THREE.Mesh(planeGeo, planeMat);
		meshPlane.receiveShadow = true;
		meshPlane.rotation.x = Math.PI * -.5;
	}

	// Main light source
	{
		pointLight = new THREE.PointLight("#F5F5F5", 3, Infinity);
		pointLight.castShadow = true;
		pointLightHelper = new THREE.PointLightHelper(pointLight, 5);
	}

	// Post processing
	{
		composer = new EffectComposer(renderer);
		composer.addPass(new RenderPass(scene, currentCamera));

		afterimagePass = new AfterimagePass();
		afterimagePass.uniforms["damp"].value = 0.96;
		composer.addPass(afterimagePass);
	}

	// Sun
	sun = new THREE.Vector3();

	// Water
	{
		water = new Water(
			planeGeo, {
				textureWidth: 512,
				textureHeight: 512,
				waterNormals: new THREE.TextureLoader().load('../img/waternormals.jpg', function (texture) {
					texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
				}),
				alpha: 1.0,
				sunDirection: new THREE.Vector3(),
				sunColor: 0xffffff,
				waterColor: 0x001e0f,
				distortionScale: 3.7,
				fog: scene.fog !== undefined
			}
		);

		water.rotation.x = -Math.PI / 2;
	}

	// Skybox
	{
		sky = new Sky();
		sky.scale.setScalar(planeSize);
		sky.name = "Sky";
		var uniforms = sky.material.uniforms;
		uniforms['turbidity'].value = 10;
		uniforms['rayleigh'].value = 2;
		uniforms['mieCoefficient'].value = 0.005;
		uniforms['mieDirectionalG'].value = 0.8;
	}

	// Sky light
	{
		hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.5);
		hemiLight.color.setHSL(0.6, 1, 0.6);
		hemiLight.groundColor.setHSL(0.095, 1, 0.75);
		hemiLight.position.set(0, 50, 0);
	}
}

function render() {
	renderer.clear();
	if (isPostProcessing)
		// render differently for the effect after image
		composer.render()
	else
		renderer.render(scene, currentCamera);
}

function addMesh(meshID) {
	switch (meshID) {
		case 1:
			mesh.geometry = BoxGeometry;
			break;
		case 2:
			mesh.geometry = SphereGeometry;
			break;
		case 3:
			mesh.geometry = ConeGeometry;
			break;
		case 4:
			mesh.geometry = CylinderGeometry;
			break;
		case 5:
			mesh.geometry = TorusGeometry;
			break;
		case 6:
			mesh.geometry = TorusKnotGeometry;
			break;
		case 7:
			mesh.geometry = TeapotGeometry;
			break;
		case 8:
			mesh.geometry = TetrahedronGeometry;
			break;
		case 9:
			mesh.geometry = OctahedronGeometry;
			break;
		case 10:
			mesh.geometry = DodecahedronGeometry;
			break;
		case 11:
			mesh.geometry = IcosahedronGeometry;
			break;
		default:
			break;
	}

	point.geometry = mesh.geometry;
	setMaterial(3)

	mesh.position.set(0, 0, 0);
	mesh.rotation.set(0, 0, 0);
	mesh.scale.set(1, 1, 1);

	render();
}
window.addMesh = addMesh;

function setMaterial(materialID) {
	type = materialID;

	// Remove current object
	pre_material != 1 ? scene.remove(mesh) : scene.remove(point);
	gui.remove(ObjColorGUI);

	if (control.object && (control.object.type == "Mesh" || control.object.type == "Points"))
		control.detach();

	switch (materialID) {
		case 1:
			point.material = PointMaterial;
			break;
		case 2:
			mesh.material = BasicMaterial;
			mesh.material.wireframe = true;
			break;
		case 3:
			if (!LightSwitch)
				mesh.material = BasicMaterial;
			else
				mesh.material = PhongMaterial;
			mesh.material.wireframe = false;
			break;
		case 4:
			if (!LightSwitch)
				mesh.material = BasicMaterial;
			else
				mesh.material = PhongMaterial;
			mesh.material.wireframe = false;
			mesh.material.map = texture;
			mesh.material.map.needsUpdate = true;
			mesh.material.needsUpdate = true;
			break;
		default:
			break;
	}

	mesh.castShadow = true;

	if (materialID != 4) {
		mesh.material.map = null;
		mesh.material.needsUpdate = true;
	}

	if (pre_material != 1 && materialID == 1) {
		point.position.copy(mesh.position);
		point.rotation.copy(mesh.rotation);
		point.scale.copy(mesh.scale);
	}

	if (pre_material == 1 && materialID != 1) {
		mesh.position.copy(point.position);
		mesh.rotation.copy(point.rotation);
		mesh.scale.copy(point.scale);
	}

	if (materialID != 1) {
		mesh.material.color.set("#F5F5F5");
		ObjColorGUI = gui.addColor(new ColorGUIHelper(mesh.material, "color"), "value").name("Obj Color");
		scene.add(mesh);
	} else {
		point.material.color.set("#F5F5F5");
		ObjColorGUI = gui.addColor(new ColorGUIHelper(point.material, "color"), "value").name("Obj Color");
		scene.add(point);
	}

	pre_material = materialID;
	render();
}
window.setMaterial = setMaterial;

function setTexture(url) {
	texture = textureLoader.load(url, render);
	texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
	setMaterial(4);
}
window.setTexture = setTexture;

function setPointLight() {
	if (!LightSwitch) {
		LightSwitch = true;
		pointLight.color.set("#F5F5F5");
		pointLight.position.set(0, 70, 70);

		scene.add(meshPlane);
		scene.add(pointLight);
		scene.add(pointLightHelper);

		if (type == 3 || type == 4)
			setMaterial(type);

		pointLightColorGUI = gui.addColor(new ColorGUIHelper(pointLight, "color"), "value").name("Light Color");
		render();
	}
}
window.setPointLight = setPointLight;

function removePointLight() {
	if (LightSwitch) {
		LightSwitch = false;

		scene.remove(pointLight);
		scene.remove(pointLightHelper);
		scene.remove(meshPlane);

		if (control.object && control.object.type == "PointLight")
			control.detach();

		if (type == 3 || type == 4)
			setMaterial(type);

		gui.remove(pointLightColorGUI);
		render();
	}
}
window.removePointLight = removePointLight;

function setControlTransform(mesh) {
	control.attach(mesh);
	scene.add(control);

	window.addEventListener("keydown", function (event) {
		switch (event.keyCode) {
			case 84: // T
				eventTranslate();
				break;
			case 82: // R
				eventRotate();
				break;
			case 83: // S
				eventScale();
				break;
		}
	});
}

function eventTranslate() {
	control.setMode("translate");
}
window.eventTranslate = eventTranslate;

function eventRotate() {
	control.setMode("rotate");
}
window.eventRotate = eventRotate;

function eventScale() {
	control.setMode("scale");
}
window.eventScale = eventScale;

document.getElementById("rendering").addEventListener("mousedown", onDocumentMouseDown, false);

function onDocumentMouseDown(event) {
	event.preventDefault();
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

	// Find intersections
	raycaster.setFromCamera(mouse, currentCamera);
	let intersects = raycaster.intersectObjects(scene.children);
	let check_obj = 0;

	if (intersects.length > 0) {
		let obj;
		for (obj in intersects) {
			if (intersects[obj].object.geometry.type == "PlaneGeometry") continue;
			if (intersects[obj].object.name == "Sky") continue;
			if (intersects[obj].object.type == "Mesh" || intersects[obj].object.type == "Points") {
				check_obj = 1;
				setControlTransform(intersects[obj].object);
				break;
			}

			if (intersects[obj].object.type == "PointLightHelper") {
				check_obj = 1;
				setControlTransform(pointLight);
				break;
			}
		}
	}

	if (check_obj == 0 && control.dragging == 0)
		control.detach();
	render();
}

var root;
var pivots = [],
	mixer = new THREE.AnimationMixer(scene);
var animalLoader = new GLTFLoader();
var animationID3 = [],
	type_animation = 0;
var box = new THREE.Box3();
function animation(id) {
	isPostProcessing = false;
	scene.add(Grid);
	box.setFromObject(type == 1 ? point : mesh);

	if (type_animation == 3 && id != 3)
		removeAnimation3();
	type_animation = id;

	if (type == null)
		return;

	root = mesh.position.clone();
	cancelAnimationFrame(animationID);

	switch (id) {
		case 1:
			animation1();
			break;
		case 2:
			isPostProcessing = true;
			//  
			animation2();
			break;
		case 3:
			removePointLight
			scene.fog = fog_634A44;
			scene.remove(Grid);
			scene.add(hemiLight);
			scene.add(water);
			scene.add(sky);
			updateSun();

			{
				animalLoader.load('models/gltf/Flamingo.glb', function (gltf) {
					const animalmesh = gltf.scene.children[0];
					const clip = gltf.animations[0];

					const s = 0.35;
					const speed = 2;
					const factor = 0.25 + Math.random();

					for (let i = 0; i < 5; i++) {
						const x = ((70 + (box.max.x - box.min.x) / 2) + Math.random() * 100) * (Math.round(Math.random()) ? -1 : 1);
						const y = 80 + Math.random() * 50;
						const z = -5 + Math.random() * 10;
						addAnimal(animalmesh, clip, speed, factor, 1, x, y, z, s, 0, 1);
					}
				});

				animalLoader.load('models/gltf/Stork.glb', function (gltf) {
					const animalmesh = gltf.scene.children[0];
					const clip = gltf.animations[0];

					const s = 0.35;
					const speed = 0.5;
					const factor = 0.5 + Math.random();

					for (let i = 0; i < 5; i++) {
						const x = ((70 + (box.max.x - box.min.x) / 2) + Math.random() * 100) * (Math.round(Math.random()) ? -1 : 1);
						const y = 80 + Math.random() * 50;
						const z = -5 + Math.random() * 10;
						addAnimal(animalmesh, clip, speed, factor, 1, x, y, z, s, 0, 2);
					}
				});

				animalLoader.load('models/gltf/Parrot.glb', function (gltf) {
					const animalmesh = gltf.scene.children[0];
					const clip = gltf.animations[0];

					const s = 0.35;
					const speed = 5;
					const factor = 1 + Math.random() - 0.5

					for (let i = 0; i < 5; i++) {
						const x = ((70 + (box.max.x - box.min.x) / 2) + Math.random() * 100) * (Math.round(Math.random()) ? -1 : 1);
						const y = 80 + Math.random() * 50;
						const z = -5 + Math.random() * 10;
						addAnimal(animalmesh, clip, speed, factor, 1, x, y, z, s, 0, 3);
					}
				});

				animalLoader.load('models/gltf/Horse.glb', function (gltf) {
					const animalmesh = gltf.scene.children[0];
					const clip = gltf.animations[0];

					const s = 0.35;
					const speed = 2.5;
					const factor = 1.25 + Math.random();

					for (let i = 0; i < 5; i++) {
						const x = ((90 + (box.max.x - box.min.x) / 2) + Math.random() * 100) * (Math.round(Math.random()) ? -1 : 1);
						// const y = 60 + Math.random() * 50;
						const z = -5 + Math.random() * 10;
						addAnimal(animalmesh, clip, speed, factor, 1, x, 0, z, s, 1, 4);
					}
				});
			}

			animation3();
			break;
	}

	render();
}
window.animation = animation;

function removeAnimation3() {
	scene.background = color_343A40;
	scene.fog = fog_343A40;
	scene.remove(hemiLight);
	scene.remove(sky);
	scene.remove(water);

	for (let i = 0; i < animationID3.length; ++i)
		cancelAnimationFrame(animationID3[i]);

	for (let i = 0; i < pivots.length; ++i)
		scene.remove(pivots[i]);

	animationID3 = [];
	pivots = [];
	mixer = new THREE.AnimationMixer(scene);
}

function addAnimal(mesh2, clip, speed, factor, duration, x, y, z, scale, fudgeColor, typeAnimal) {
	mesh2 = mesh2.clone();
	mesh2.material = mesh2.material.clone();

	if (fudgeColor)
		mesh2.material.color.offsetHSL(0, Math.random() * 0.5 - 0.25, Math.random() * 0.5 - 0.25);

	mesh2.factor = factor;

	mixer.clipAction(clip, mesh2).setDuration(duration).startAt(-duration * Math.random()).play();
	let length = mixer._actions.length;
	mixer._actions[length - 1].timeScale = speed;
	mesh2.position.set(x, y, z);
	mesh2.rotation.set(0, x > 0 ? Math.PI : 0, 0);
	mesh2.scale.set(scale, scale, scale);

	mesh2.castShadow = true;
	mesh2.receiveShadow = true;

	let pivot = new THREE.Group();

	if (typeAnimal != 4)
		pivot.position.copy(root);
	else
		pivot.position.set(root.x, 0, root.z);

	pivot.rotation_check = 0;
	scene.add(pivot);
	pivot.add(mesh2);
	pivots.push(pivot);
}

var ani1_step = 0.25;

function animation1() {
	mesh.position.y += ani1_step;
	mesh.position.z += ani1_step * 3;

	mesh.rotation.x += Math.abs(ani1_step / 10);
	mesh.rotation.y += Math.abs(ani1_step / 10);
	mesh.rotation.z += Math.abs(ani1_step / 10);

	point.rotation.copy(mesh.rotation);
	point.position.copy(mesh.position);

	let distance = Math.abs(Math.floor(mesh.position.y - root.y));

	if (distance % 10 == 0) {
		if (distance / 10 == 3)
			ani1_step *= -1;
		if (distance / 10 == 0)
			setMaterial(3);
		if (distance / 10 == 1 || distance / 10 == 2)
			setMaterial(2 / (distance / 10));
	}

	render();

	animationID = requestAnimationFrame(animation1);
}

var ani2_step = 0;

function animation2() {
	ani2_step += 0.05;
	let width = box.max.x - box.min.x;
	mesh.position.x = width * Math.cos(ani2_step) + root.x;
	mesh.position.y = width * Math.sin(ani2_step) + root.y;
	point.position.copy(mesh.position);

	mesh.rotation.x += 0.03;
	mesh.rotation.y += 0.03;
	point.rotation.copy(mesh.rotation);

	render();
	animationID = requestAnimationFrame(animation2);
}

var clock = new THREE.Clock();

function animation3() {
	let delta = clock.getDelta();
	mixer.update(delta);

	mesh.rotation.x += delta;
	mesh.rotation.y += delta;
	point.rotation.copy(mesh.rotation);

	for (let i = 0; i < pivots.length; i++) {
		let f = pivots[i].children[0].factor;
		pivots[i].rotation.y += Math.sin((delta * f) / 2) * Math.cos((delta * f) / 2) * 2.5;
	}
	water.material.uniforms['time'].value += 1.0 / 60.0;

	render();

	animationID3.push(requestAnimationFrame(animation3));
}

function updateCamera() {
	currentCamera.updateProjectionMatrix();
	render();
}


function updateSun() {
	let pmremGenerator = new THREE.PMREMGenerator(renderer);
	let inclination = 0.49;
	let azimuth = 0.205;

	let theta = Math.PI * (inclination - 0.5);
	let phi = 2 * Math.PI * (azimuth - 0.5);

	sun.x = Math.cos(phi);
	sun.y = Math.sin(phi) * Math.sin(theta);
	sun.z = Math.sin(phi) * Math.cos(theta);

	sky.material.uniforms['sunPosition'].value.copy(sun);
	water.material.uniforms['sunDirection'].value.copy(sun).normalize();

	scene.environment = pmremGenerator.fromScene(sky).texture;
}
