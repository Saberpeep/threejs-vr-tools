import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import Mega_toString from './mega_toString.js';
import constants from './constants.js';
import utils from './utils.js';
import Locomotion from './locomotion.js';
import Interactables from './interactables.js';

var interactables, button1, lever1;

var container;
var player, camera, scene, renderer;
var controller1, controller2, pointers = [];
var controllerGrip1, controllerGrip2, grips = [];

var raycaster, intersected = [];
var tempMatrix = new THREE.Matrix4();
var tempVector = new THREE.Vector3();
var tempVector2 = new THREE.Vector3();
var tempEuler = new THREE.Euler();

var controls, grabables;

var canvasCtx, canvasTexture, canvasMaterial;
var debugDisplay, mega_toString;

var tpSurfaces, tpBlockers;

const roomSize = 10;

var locomotion;

init();
animate();

function init() {

	container = document.createElement( 'div' );
	document.body.appendChild( container );

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x808080 );

	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.set( 0, 1.6, 3 );

	player = new THREE.Group();
	player.attach(camera);
	scene.add(player);

	controls = new OrbitControls( camera, container );
	controls.target.set( 0, 1.6, 0 );
	controls.update();

	scene.add( new THREE.HemisphereLight( 0x808080, 0x606060 ) );

	var light = new THREE.DirectionalLight( 0xffffff );
	light.position.set( 1, 6, 1 );
	light.castShadow = true;
	light.shadow.camera.top = 2;
	light.shadow.camera.bottom = - 2;
	light.shadow.camera.right = 2;
	light.shadow.camera.left = - 2;
	light.shadow.mapSize.set( 4096, 4096 );
	scene.add( light );

	// Grabables

	grabables = new THREE.Group();
	scene.add( grabables );

	var geometries = [
		new THREE.BoxBufferGeometry( 0.2, 0.2, 0.2 ),
		new THREE.ConeBufferGeometry( 0.2, 0.2, 64 ),
		new THREE.CylinderBufferGeometry( 0.2, 0.2, 0.2, 64 ),
		new THREE.IcosahedronBufferGeometry( 0.2, 3 ),
		new THREE.TorusBufferGeometry( 0.2, 0.04, 64, 32 )
	];

	for ( var i = 0; i < 50; i ++ ) {

		var geometry = geometries[ Math.floor( Math.random() * geometries.length ) ];
		var material = new THREE.MeshStandardMaterial( {
			color: Math.random() * 0xffffff,
			roughness: 0.7,
			metalness: 0.0
		} );

		var object = new THREE.Mesh( geometry, material );

		object.position.x = Math.random() * roomSize - (roomSize/2);
		object.position.y = Math.random() * 2;
		object.position.z = Math.random() * roomSize - (roomSize/2);

		object.rotation.x = Math.random() * 2 * Math.PI;
		object.rotation.y = Math.random() * 2 * Math.PI;
		object.rotation.z = Math.random() * 2 * Math.PI;

		object.scale.setScalar( Math.random() + 0.5 );

		object.castShadow = true;
		object.receiveShadow = true;

		grabables.add( object );

		break;//only one (for debug)
	}

	// Floor

	var floorGeometry = new THREE.PlaneBufferGeometry( roomSize, roomSize );
	var floorMaterial = new THREE.MeshStandardMaterial( {
		color: 0x999999,
		roughness: 1.0,
		metalness: 0.0
	} );
	var floor = new THREE.Mesh( floorGeometry, floorMaterial );
	floor.rotation.x = - Math.PI / 2;
	floor.receiveShadow = true;
	scene.add( floor );

	// Teleport Surfaces

	tpSurfaces = new THREE.Group();
	scene.add( tpSurfaces );
	tpBlockers = new THREE.Group();
	scene.add( tpBlockers );

	tpSurfaces.attach(floor);
	// var floor2 = floor.clone();
	// floor2.position.y = 0.2;
	// floor2.scale.set(0.25, 0.25, 1);
	// floor2.material.color.setHex(0xff0000);
	// scene.add(floor2);
	var tpBoxGeo = new THREE.BoxBufferGeometry( 0.8, 0.2, 0.8 );

	//add random blockers and platforms
	for ( var i = 0; i < 10; i ++ ) {

		var blocker = !!(i < 8);

		var geometry = tpBoxGeo;
		var material = new THREE.MeshStandardMaterial( {
			color: (blocker)? 0xff0000 : 0x00ff00,
			roughness: 0.7,
			metalness: 0.0
		} );

		var object = new THREE.Mesh( geometry, material );

		var scale = Math.random() + 0.5;

		object.position.x = Math.random() * roomSize - (roomSize/2);
		object.position.y = scale * 0.2 / 2;
		object.position.z = Math.random() * roomSize - (roomSize/2);

		object.rotation.y = Math.random() * 2 * Math.PI;

		object.scale.setScalar(1 + scale);

		object.castShadow = true;
		object.receiveShadow = true;

		if(blocker){
			tpBlockers.add( object );
		}else{
			tpSurfaces.add( object );
		}

	}


	// renderer

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.outputEncoding = THREE.sRGBEncoding;
	renderer.shadowMap.enabled = true;
	renderer.xr.enabled = true;
	container.appendChild( renderer.domElement );

	document.body.appendChild( VRButton.createButton( renderer ) );

	window.addEventListener( 'resize', onWindowResize, false );

	// controllers

	var controllerModelFactory = new XRControllerModelFactory();

	var handColliderGeo = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1);
	var handColliderMat = new THREE.MeshBasicMaterial({color:0x333333});
	for (var i of [0,1]){
		pointers[i] = renderer.xr.getController(i);
		pointers[i].addEventListener( 'selectstart', onSelectStart );
		pointers[i].addEventListener( 'selectend', onSelectEnd );
		player.add(pointers[i]);

		grips[i] = renderer.xr.getControllerGrip(i);
		grips[i].add( controllerModelFactory.createControllerModel(grips[i]) );
		var handCollider = new THREE.Mesh(handColliderGeo, handColliderMat);
		handCollider.name = "handCollider";
		handCollider.visible = false;
		grips[i].add(handCollider);
		player.add( grips[i] );
	}

	// Selection

	var lineGeometry = new THREE.BufferGeometry().setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, - 1 ) ] );

	var line = new THREE.Line( lineGeometry );
	line.name = 'line';
	line.scale.z = 5;

	pointers[0].add( line.clone() );
	pointers[1].add( line.clone() );

	raycaster = new THREE.Raycaster();

	// Teleportation

	locomotion = new Locomotion({
		renderer: renderer,
		scene: scene,
		camera: camera,
		player: player,
		tpSurfaces: tpSurfaces.children,
		tpBlockers: tpBlockers.children,
	});

	// Debug canvas texture for debug info
	
	canvasCtx = document.createElement('canvas').getContext('2d');
	var debugPlaneW = 0.2;
	var debugPlaneH = 0.4;
	var debugDisplayGeo = new THREE.PlaneBufferGeometry(debugPlaneW, debugPlaneH, 1, 1);
	canvasCtx.canvas.width = debugPlaneW * 10 * 256;
	canvasCtx.canvas.height = debugPlaneH * 10 * 256;
	canvasCtx.fillStyle = '#FFF';
	canvasCtx.fillRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
	canvasTexture = new THREE.CanvasTexture(canvasCtx.canvas);
	canvasMaterial = new THREE.MeshBasicMaterial({
		map: canvasTexture,
	});
	mega_toString = new Mega_toString();

	debugDisplay = new THREE.Mesh(debugDisplayGeo, canvasMaterial);
	debugDisplay.rotation.setFromVector3(tempVector.set(-Math.PI / 2 - Math.PI / 4, 0, -Math.PI / 2));
	debugDisplay.translateOnAxis(constants.x, 0.2);

	// Interactables

	interactables = new Interactables({
		scene: scene,
	});

	// Button
	var buttonGeo = new THREE.CylinderBufferGeometry( 0.1, 0.1, 0.1, 8 );
	var buttonBaseGeo = new THREE.CylinderBufferGeometry( 0.2, 0.2, 0.1, 8 );
	var buttonMat = new THREE.MeshBasicMaterial({color: 0xff0000});
	var buttonBaseMat = new THREE.MeshBasicMaterial({color: 0x999999});
	var buttonMesh1 = new THREE.Mesh(buttonGeo, buttonMat);
	var buttonBaseMesh1 = new THREE.Mesh(buttonBaseGeo, buttonBaseMat);
	buttonMesh1.position.y = 0.1;
	buttonMesh1.castShadow = true;
	buttonMesh1.receiveShadow = true;
	buttonBaseMesh1.castShadow = true;
	buttonBaseMesh1.receiveShadow = true;
	button1 = new interactables.Button({
		plunger: buttonMesh1,
		offset: new THREE.Vector3(0,0.05,0),
		throwLength: 0.09,
	});
	button1.add(buttonMesh1);
	button1.add(buttonBaseMesh1);
	scene.add(button1);
	button1.position.set(0.2, 1, -1);
	button1.rotation.x = Math.PI / 2;

	// Lever
	var leverGeo = new THREE.BoxBufferGeometry( 1, 2, 0.1 );
	var leverHandleGeo = new THREE.CylinderBufferGeometry( 0.07, 0.07, 0.3, 8 );
	var leverMat = new THREE.MeshBasicMaterial({color: 0x999999});
	var leverHandleMat = new THREE.MeshBasicMaterial({color: 0x555555});
	var leverMesh1 = new THREE.Mesh(leverGeo, leverMat);
	var leverHandleMesh1 = new THREE.Mesh(leverHandleGeo, leverHandleMat);
	leverMesh1.position.y = 1;
	leverMesh1.castShadow = true;
	leverMesh1.receiveShadow = true;
	leverHandleMesh1.castShadow = true;
	leverHandleMesh1.receiveShadow = true;
	leverMesh1.position.set(0.5, 1, 0);
	leverHandleMesh1.position.set(0.9, 1, 0);
	leverHandleMesh1.rotation.x = Math.PI / 2;
	lever1 = new interactables.Lever({
		handlePos: leverHandleMesh1.position,
		min: 0,
		max: Math.PI,
	});
	lever1.position.set(1,0,0.5);
	lever1.rotation.y = Math.PI / 2;
	lever1.add(leverMesh1);
	lever1.add(leverHandleMesh1);
	scene.add(lever1);

}

function clearCanvas(){
	var temp = utils.copy(canvasCtx.fillStyle);
	canvasCtx.fillStyle = '#FFF';
	canvasCtx.fillRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
	canvasCtx.fillStyle = temp;
}
function drawTextToCanvas(message){
	clearCanvas();
	var lines = message.split('\n');
	var lineHeight = canvasCtx.measureText(lines[0]).actualBoundingBoxAscent;
	var offset = 10 + lineHeight;
	for (var line of lines){
		canvasCtx.fillStyle = '#000';
		canvasCtx.font = 'small-caption';
		canvasCtx.fillText(line, 10, offset);
		offset += lineHeight + 5
	}

	canvasTexture.needsUpdate = true;
}

function drawDebugToCanvas(obj){
	drawTextToCanvas(mega_toString.print(obj));
}

function getControlerHandednessData(){
	var session = renderer.xr.getSession();
	if (session && session.inputSources){

		var gamepads = {};
		session.inputSources.forEach((val, index)=>{gamepads[val.handedness] = index});
		return gamepads;
	}
	return null;
}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function onSelectStart( event ) {

	var controller = event.target;

	var intersections = getIntersections( controller );

	if ( intersections.length > 0 ) {

		var intersection = intersections[ 0 ];

		var object = intersection.object;
		object.material.emissive.b = 1;
		controller.attach( object );

		controller.userData.selected = object;

	}

}

function onSelectEnd( event ) {

	var controller = event.target;

	if ( controller.userData.selected !== undefined ) {

		var object = controller.userData.selected;
		object.material.emissive.b = 0;
		grabables.attach( object );

		controller.userData.selected = undefined;

	}


}

function getIntersections( controller ) {

	tempMatrix.identity().extractRotation( controller.matrixWorld );

	raycaster.ray.origin.setFromMatrixPosition( controller.matrixWorld );
	raycaster.ray.direction.set( 0, 0, - 1 ).applyMatrix4( tempMatrix );

	return raycaster.intersectObjects( grabables.children );

}

function intersectObjects( controller ) {

	// Do not highlight when already selected

	if ( controller.userData.selected !== undefined ) return;

	var line = controller.getObjectByName( 'line' );
	var intersections = getIntersections( controller );

	if ( intersections.length > 0 ) {

		var intersection = intersections[ 0 ];

		var object = intersection.object;
		object.material.emissive.r = 1;
		intersected.push( object );

		line.scale.z = intersection.distance;

	} else {

		line.scale.z = 5;

	}

}

function cleanIntersected() {

	while ( intersected.length ) {

		var object = intersected.pop();
		object.material.emissive.r = 0;

	}

}

//

function animate() {

	renderer.setAnimationLoop( render );

}

var runOnce = false;

function render() {

	cleanIntersected();

	var session = renderer.xr.getSession();
	if(session && renderer.xr.isPresenting){
		if (session.inputSources && session.inputSources[0]){
			var controllers = {};
			session.inputSources.forEach((val, i)=>{controllers[val.handedness] = {
				gamepad: val.gamepad,
				pointer: pointers[i],
				grip: grips[i],
			}});


			if (controllers['right']){
				if (!runOnce){
					controllers['right'].grip.add(debugDisplay);
					runOnce = true;
				}

				var rightThumbstick = {x: controllers['right'].gamepad.axes[2], y: controllers['right'].gamepad.axes[3]};

				locomotion.handleInput(controllers['right'].pointer, rightThumbstick);

				button1.update(controllers['right'].grip.getObjectByName('handCollider'));
				var leverRes = lever1.update(controllers['right'].grip, controllers['right'].gamepad.buttons[1].pressed);
				drawDebugToCanvas({lever1: leverRes});
	
				// var headAngle = utils.getWorldRotation(renderer.xr.getCamera(camera), constants.y, tempEuler).y;
				// var playerAngle = utils.getWorldRotation(player, constants.y, tempEuler).y;
				// drawDebugToCanvas({head: headAngle, player: playerAngle, offset: headAngle - playerAngle });
	
				// drawDebugToCanvas({gp0: controllers['right'].gamepad.axes, gp1: controllers['left'].gamepad.axes, tpMode: tpMode, flickTurning: flickTurning});
	
				//gamepad mapping (oculus touch v2)
				//trigger: 0, gripTrigger: 1, thumbstickClick: 3, A/X:4, B/Y: 5
				//grip touched doesnt seem to work unless you also press it a little
				// var out = [];
				// var index = 0;
				// for (var btn of controllers['left'].gamepad.buttons){
				// 	out[index++] = {
				// 		pressed: btn.pressed,
				// 		touched: btn.touched,
				// 		value: btn.value,
				// 		btn: btn,
				// 	};
				// }
				// drawDebugToCanvas(out);
	
			}

			
		} 
	}
	// drawTextToCanvas(Object.keys(controllerGrip2).join(', '))
	
	intersectObjects( pointers[0] );
	intersectObjects( pointers[1] );

	renderer.render( scene, camera );

}
