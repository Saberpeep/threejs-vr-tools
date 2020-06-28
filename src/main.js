import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import Mega_toString from './mega_toString.js';
import { MeshBasicMaterial } from 'three';

var container;
var player, camera, scene, renderer;
var controller1, controller2;
var controllerGrip1, controllerGrip2;

var raycaster, intersected = [];
var tempMatrix = new THREE.Matrix4();
var tempVector = new THREE.Vector3();
var tempVector2 = new THREE.Vector3();
var tempEuler = new THREE.Euler();

var controls, grabables;

var canvasCtx, canvasTexture, canvasMaterial;
var debugDisplay, mega_toString;

var tpArc, tpGhost, tpSurfaces, tpBlockers, debugGhost, tpCurve, tpArcShape;

const x = new THREE.Vector3(1,0,0);
const y = new THREE.Vector3(0,1,0);
const z = new THREE.Vector3(0,0,1);
const origin = new THREE.Vector3(0,0,0);
const negY = y.clone().negate();

const roomSize = 10;

var gltfloader = new GLTFLoader();

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

	controller1 = renderer.xr.getController( 0 );
	controller1.addEventListener( 'selectstart', onSelectStart );
	controller1.addEventListener( 'selectend', onSelectEnd );
	player.add( controller1 );

	controller2 = renderer.xr.getController( 1 );
	controller2.addEventListener( 'selectstart', onSelectStart );
	controller2.addEventListener( 'selectend', onSelectEnd );
	player.add( controller2 );

	var controllerModelFactory = new XRControllerModelFactory();

	controllerGrip1 = renderer.xr.getControllerGrip( 0 );
	controllerGrip1.add( controllerModelFactory.createControllerModel( controllerGrip1 ) );
	player.add( controllerGrip1 );

	controllerGrip2 = renderer.xr.getControllerGrip( 1 );
	controllerGrip2.add( controllerModelFactory.createControllerModel( controllerGrip2 ) );
	player.add( controllerGrip2 );

	// Selection

	var geometry = new THREE.BufferGeometry().setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, - 1 ) ] );

	var line = new THREE.Line( geometry );
	line.name = 'line';
	line.scale.z = 5;

	controller1.add( line.clone() );
	controller2.add( line.clone() );

	raycaster = new THREE.Raycaster();

	// Teleportation

	tpArcShape = new THREE.Shape();
	tpArcShape.moveTo( 0.05, 0 );
	tpArcShape.lineTo( 0, 0.1 );;
	tpArcShape.lineTo( 0.1, 0.1 );
	tpArcShape.lineTo( 0.05, 0 );
	tpCurve = new THREE.CubicBezierCurve3(
		new THREE.Vector3(0,1,0),
		new THREE.Vector3(0,2,0),
		new THREE.Vector3(0,1,1),
		new THREE.Vector3(0,0,1)
	);
	// var curveGeometry = new THREE.ExtrudeGeometry(tpArcShape, {extrudePath: tpCurve, steps: 20})
	// var curveMaterial = new THREE.MeshBasicMaterial( { color : 0xff0000 } );
	// tpArc = new THREE.Mesh( curveGeometry, curveMaterial );
	// tpArc.visible = false;
	// scene.add(tpArc);
	// console.log(tpArc);

	var tpGhostGeo = new THREE.CylinderBufferGeometry( 0.2, 0.2, 0.2, 64 );
	var tpGhostMat = new THREE.MeshBasicMaterial({color: 0x5555ff});
	tpGhost = new THREE.Mesh(tpGhostGeo, tpGhostMat);
	tpGhost.visible = false;
	scene.add(tpGhost);

	gltfloader.load(
		// resource URL
		'tpPointer.glb',
		// called when the resource is loaded
		function ( gltf ) {
			console.log("loaded tpPointer", gltf);
			var isVisible = (tpGhost && tpGhost.visible) || false;
			scene.remove(tpGhost);
			tpGhost = gltf.scene.getObjectByName('tpPointer');
			if(tpGhost.geometry){
				tpGhost.geometry.computeBoundingBox();
			}
			tpGhost.visible = isVisible;
			tpGhost.scale.multiplyScalar(0.3)
			scene.add(tpGhost);
			console.log("tpGhost:", tpGhost);

			debugGhost = tpGhost.clone(true);
			debugGhost.children[0].material = debugGhost.children[0].material.clone()
			debugGhost.children[0].material.emissive.setHex(0x00ff99);
			debugGhost.visible = true;
			scene.add(debugGhost);
		},
		// called while loading is progressing
		null,
		// called when loading has errors
		function ( e ) {
			console.error( 'error loading model', e );
		}
	);
	gltfloader.load(
		// resource URL
		'tpArc.glb',
		// called when the resource is loaded
		function ( gltf ) {
			console.log("loaded tpArc", gltf);
			tpArc = gltf.scene.getObjectByName('Armature');
			console.log("tpArc", tpArc);
			scene.add(tpArc);

			tpArc.rotation.x = -Math.PI / 2;

			tpArc.position.set(0,0,0);
			tpArc.scale.set(-1,1,1);
			tpArc.updateMatrixWorld();
			var mesh = tpArc.getObjectByProperty('type', 'SkinnedMesh');
			mesh.material.color.set(0x0099ff);
			tpArc.getObjectByName('tpArc').material = new THREE.MeshBasicMaterial({color: 0x0099ff, skinning: true, side: THREE.DoubleSide});

			setTpArc(tpCurve);
		},
		// called while loading is progressing
		null,
		// called when loading has errors
		function ( e ) {
			console.error( 'error loading model', e );
		}
	);

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
	debugDisplay.translateOnAxis(x, 0.2);
}

function setTpArc(curve){
	var points = curve.getPoints(20);
	var i = 0;
	var currBone = tpArc.getObjectByName('rootBone');
	tpArc.position.copy(points[0]);
	currBone.position.set(0,0,0);
	currBone = currBone.children[0];
	
	while(currBone && i < points.length){
		
		tempVector.subVectors(points[i - 1] || points[i], points[i]);
		currBone.position.copy(tempVector);

		currBone = currBone.children[0];
		i++;
	}
}

function copy(obj){
	return JSON.parse(JSON.stringify({val: obj})).val;
}

function clearCanvas(){
	var temp = copy(canvasCtx.fillStyle);
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

var tpRay = new THREE.Raycaster();
var tpHelperA = new THREE.ArrowHelper(x, origin, 5, 0x0000ff);
tpHelperA.visible = false;
scene.add(tpHelperA);
var tpHelperB = new THREE.ArrowHelper(x, origin, 5, 0x000099);
tpHelperB.visible = false;
scene.add(tpHelperB);
var tpMode = false;
var flickTurning = false;
var teleportPoint;
var runOnce = false;
var gripObj, selectorObj;

var tpHelperC = new THREE.AxesHelper();
tpHelperC.visible = false;
scene.add(tpHelperC);

function flickTurn(dir){
	var direction = (dir > 0)? -1 : 1;

	player.rotateOnWorldAxis(y, Math.PI / 15 * direction);
}

function teleportStart(selectorObj, thumbstickVal){
	var controller = selectorObj;
	tempMatrix.identity().extractRotation( controller.matrixWorld );
	tpRay.ray.origin.setFromMatrixPosition( controller.matrixWorld );
	tpRay.ray.direction.set( 0, 0, - 1 ).applyMatrix4( tempMatrix );

	//update 1st half of arc line
	tpCurve.v0.copy(tpRay.ray.origin);
	tempVector.set(0, 0.2, 0).applyMatrix4( controller.matrixWorld );
	tpCurve.v1.copy(tempVector);

	tpHelperC.position.copy(tempVector);
	tpHelperC.visible = true;

	//helper arrow for debug
	tpHelperA.position.copy(tpRay.ray.origin);
	tpHelperA.setDirection(tpRay.ray.direction);
	tpHelperA.visible = true;

	debugGhost.position.copy(player.position);
	debugGhost.quaternion.copy(player.quaternion);

	var intersections = tpRay.intersectObjects(tpSurfaces.children.concat(tpBlockers.children));
	if ( intersections.length > 0 ) {

		var intersection = intersections[ 0 ];

		//helper arrow for debug
		tpHelperA.setLength(intersection.distance);

		//cast second ray down
		camera.getWorldPosition(tempVector2);
		tempVector2.x = intersection.point.x;
		tempVector2.z = intersection.point.z;
		tpRay.set(tempVector2, negY);

		//2nd helper arrow for debug
		tpHelperB.position.copy(tpRay.ray.origin);
		tpHelperB.setDirection(tpRay.ray.direction);
		tpHelperB.visible = true;

		var intersections2 = tpRay.intersectObjects(tpSurfaces.children);
		if ( intersections2.length > 0 ) {

			var intersection2 = intersections2[ 0 ];

			//update 2nd half of arc line
			tpCurve.v2.copy(intersection2.point);
			tpCurve.v2.y = tpRay.ray.origin.y;
			tpCurve.v3.copy(intersection2.point);
			// tpArc.geometry.dispose();
			// tpArc.geometry = new THREE.TubeBufferGeometry( tpCurve, 20, 0.5, 8, false );
			// tpArc.geometry.needsUpdate = true;
			// tpArc.visible = true;
			if(tpArc){
				setTpArc(tpCurve);
			}

			//helper arrow for debug
			tpHelperB.setLength(intersection2.distance);

			teleportPoint = intersection2.point;
			tpGhost.visible = true;
			tpGhost.position.copy(intersection2.point);

			//get thumbstick angle
			var stickAngle = getAngleBetweenPoints(origin, thumbstickVal);
			//get controller angle
			var contAngle = tempEuler.setFromRotationMatrix(tempMatrix).y;
			//get head angle
			// var headAngle = getWorldRotation(renderer.xr.getCamera(camera), y, tempEuler);
			// drawDebugToCanvas({head: headAngle});

			tpGhost.rotation.y = -stickAngle + contAngle;


		}else{
			teleportPoint = null;
		}

	} else {
		teleportPoint = null;
	}
}
function teleportEnd(){
	tpGhost.visible = false;
	tpHelperA.visible = false;
	tpHelperB.visible = false;
	tpHelperC.visible = false;

	if(teleportPoint){
		// get head angle
		// This creates an offset to aacount for the user physically turning around,
		// and thus no longer lining up with the player object.
		var headAngle = getWorldRotation(renderer.xr.getCamera(camera), y, tempEuler).y;
		var playerAngle = getWorldRotation(player, y, tempEuler).y;
		var offset = headAngle - playerAngle;


		//teleport player to new position and rotation
		player.position.copy(tpGhost.position);
		player.rotation.y = tpGhost.rotation.y - offset;

		//update debug ghost to match player object
		debugGhost.position.copy(player.position);
		debugGhost.quaternion.copy(player.quaternion);
	}
}

function getAngleBetweenPoints(p1, p2, a = 'x', b = 'y'){
    return Math.atan2(p2[b] - p1[b], p2[a] - p1[a]) + Math.PI / 2; 
    //returns radians (...* 180 / Math.PI for degrees)
    //adding pi to offset ouput into positive range (0-360)
}

function getWorldRotation(object, axis, euler){
	object.updateMatrixWorld();
	tempMatrix.identity().extractRotation( object.matrixWorld );
	if(axis.x){
		euler.set(0,0,0,'XYZ');
		euler.setFromRotationMatrix(tempMatrix);
	}else if(axis.y){
		euler.set(0,0,0,'YXZ');
		euler.setFromRotationMatrix(tempMatrix);
	}else if(axis.z){
		euler.set(0,0,0,'ZXY');
		euler.setFromRotationMatrix(tempMatrix);
	}else{
		throw new Error('invalid axis');
	}
	return euler;
}

function render() {

	cleanIntersected();

	var session = renderer.xr.getSession();
	if(session && renderer.xr.isPresenting){
		if (session.inputSources && session.inputSources[0]){
			var gamepads = {};
			session.inputSources.forEach((val, index)=>{gamepads[val.handedness] = val.gamepad});

			var primaryGamepad = gamepads['right'] || gamepads['left'] || gamepads['none'];	
			if(!primaryGamepad){
				console.warn("No Primary Gamepad:", gamepads);
				renderer.render( scene, camera );
				return;
			}

			if (!runOnce){
			
				if(session.inputSources[0].gamepad === primaryGamepad){
					gripObj = controllerGrip1;
					selectorObj = controller1;
				}else{
					gripObj = controllerGrip2;
					selectorObj = controller2;
				}
				gripObj.add(debugDisplay);
				runOnce = true;
			}

			var primaryThumbstick = {x: primaryGamepad.axes[2], y: primaryGamepad.axes[3]};

			//the tpend condition must come before the tpstart condition, otherwise the last thumbstick position may be invalid
			if(Math.abs(primaryThumbstick.y) < 0.1 && Math.abs(primaryThumbstick.x) < 0.1){
				if(tpMode){
					teleportEnd();
				}
				tpMode = false;
			}
			if(primaryThumbstick.y < -0.9 || tpMode){
				tpMode = true;
				teleportStart(selectorObj, primaryThumbstick);
			}
			if(Math.abs(primaryThumbstick.x) > 0.7){
				if(!tpMode && !flickTurning){
					flickTurning = true;
					flickTurn(primaryThumbstick.x);
				}	
			}else{
				flickTurning = false;
			}
			var headAngle = getWorldRotation(renderer.xr.getCamera(camera), y, tempEuler).y;
			var playerAngle = getWorldRotation(player, y, tempEuler).y;
			drawDebugToCanvas({head: headAngle, player: playerAngle, offset: headAngle - playerAngle });
			//drawDebugToCanvas({gp0: gamepads['right'].axes, gp1: gamepads['left'].axes, tpMode: tpMode, flickTurning: flickTurning});
		} 
	}
	// drawTextToCanvas(Object.keys(controllerGrip2).join(', '))
	
	intersectObjects( controller1 );
	intersectObjects( controller2 );

	renderer.render( scene, camera );

}
