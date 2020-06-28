import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import constants from './constants.js';
import utils from './utils.js';

export default function Teleportation(globals){

    //globals
    //renderer, scene, camera, player, tpSurfaces, tpBlockers

    var locals = {
        //ghost, debugGhost, arc, curve, surfaces, blockers, arrowHelpers
    }
    var state = {
        //teleporting, flickTurning, teleportPoint
    }
    var temps = {
        //vector, matrix, euler
        vector: new THREE.Vector3(),
        matrix: new THREE.Matrix4(),
        euler: new THREE.Euler(),
        rayCaster: new THREE.Raycaster(),
    }

    const debugMode = false;

    init();
    function init(){
        state.teleporting = false;
        state.flickTurning = false;

        var required = ['renderer', 'scene', 'camera', 'player', 'tpSurfaces', 'tpBlockers'];
        if (!globals){
            throw new Error('Teleportation requires globals from your scope');
        }
        for (var key of required){
            if (!globals[key]){
                throw new Error(`Teleportation requires ${key} from your scope`);
            }
        }

        if(debugMode){
            locals.helpers = [];
            locals.helpers[0] = new THREE.ArrowHelper(constants.x, constants.origin, 5, 0x0000ff);
            locals.helpers[0].visible = false;
            globals.scene.add(locals.helpers[0]);
            locals.helpers[1] = new THREE.ArrowHelper(constants.x, constants.origin, 5, 0x000099);
            locals.helpers[1].visible = false;
            globals.scene.add(locals.helpers[1]);
            locals.helpers[2] = new THREE.AxesHelper();
            locals.helpers[2].visible = false;
            globals.scene.add(locals.helpers[2]);
        }
        
        locals.curve = new THREE.CubicBezierCurve3(
            new THREE.Vector3(0,1,0),
            new THREE.Vector3(0,2,0),
            new THREE.Vector3(0,1,1),
            new THREE.Vector3(0,0,1)
        );
        
        var tempGhostGeo = new THREE.CylinderBufferGeometry( 0.2, 0.2, 0.2, 64 );
        var tempGhostMat = new THREE.MeshBasicMaterial({color: 0x5555ff});
        locals.ghost = new THREE.Mesh(tempGhostGeo, tempGhostMat);
        locals.ghost.visible = false;
        globals.scene.add(locals.ghost);

        var gltfloader = new GLTFLoader();

        loadModel(gltfloader, 'tpArc.glb').then(gltf=>{
            var arc = gltf.scene.getObjectByName('Armature');
            console.log("locomotion: arc", arc);
            globals.scene.add(arc);
            arc.visible = false;
    
            arc.rotation.x = -Math.PI / 2;
    
            arc.position.set(0,0,0);
            arc.scale.set(-1,1,1);
            arc.updateMatrixWorld();
            var mesh = arc.getObjectByProperty('type', 'SkinnedMesh');
            mesh.material = new THREE.MeshBasicMaterial({color: 0x0099ff, skinning: true, side: THREE.DoubleSide});
            locals.arc = arc;
    
            setTpArc(locals.curve);
        }).catch(e=>{console.error(e)});
        loadModel(gltfloader, 'tpPointer.glb').then(gltf=>{
            var wasVisible = (locals.ghost && locals.ghost.visible) || false;
            globals.scene.remove(locals.ghost);
            var ghost = gltf.scene.getObjectByName('tpPointer');
            if(ghost.geometry){
                ghost.geometry.computeBoundingBox();
            }
            ghost.visible = wasVisible;
            ghost.scale.multiplyScalar(0.3)
            globals.scene.add(ghost);
            console.log("locomotion: ghost:", ghost);
            locals.ghost = ghost;
    
            if(debugMode){
                var debugGhost = ghost.clone(true);
                debugGhost.children[0].material = debugGhost.children[0].material.clone()
                debugGhost.children[0].material.emissive.setHex(0x00ff99);
                debugGhost.visible = true;
                globals.scene.add(debugGhost);
                locals.debugGhost = debugGhost;
            }
            
        }).catch(e=>{console.error(e)});
    }

    locals.teleportStart = teleportStart;
    function teleportStart(selectorObj, thumbstickVal){
        var controller = selectorObj;
        temps.matrix.identity().extractRotation( controller.matrixWorld );
        temps.rayCaster.ray.origin.setFromMatrixPosition( controller.matrixWorld );
        temps.rayCaster.ray.direction.set( 0, 0, - 1 ).applyMatrix4( temps.matrix );
    
        //update 1st half of arc line
        locals.curve.v0.copy(temps.rayCaster.ray.origin);
        temps.vector.set(0, 0.2, 0).applyMatrix4( controller.matrixWorld );
        locals.curve.v1.copy(temps.vector);
    
        if(debugMode){
            //helper for first curve control point
            locals.helpers[2].position.copy(temps.vector);
            locals.helpers[2].visible = true;
            //set up helper arrow for first ray
            locals.helpers[0].position.copy(temps.rayCaster.ray.origin);
            locals.helpers[0].setDirection(temps.rayCaster.ray.direction);
            locals.helpers[0].visible = true;
            //update debug ghost to show player position
            locals.debugGhost.position.copy(globals.player.position);
            locals.debugGhost.quaternion.copy(globals.player.quaternion);
        }

    
        var intersections = temps.rayCaster.intersectObjects(globals.tpSurfaces.concat(globals.tpBlockers));
        if ( intersections.length > 0 ) {
    
            var intersection = intersections[ 0 ];
    
            //cast second ray down
            globals.camera.getWorldPosition(temps.vector);
            temps.vector.x = intersection.point.x;
            temps.vector.z = intersection.point.z;
            temps.rayCaster.set(temps.vector, constants.negY);
    
            if(debugMode){
                //update helper arrow for first ray
                locals.helpers[0].setLength(intersection.distance);
                //set up helper arrow for 2nd ray
                locals.helpers[1].position.copy(temps.rayCaster.ray.origin);
                locals.helpers[1].setDirection(temps.rayCaster.ray.direction);
                locals.helpers[1].visible = true;
            }
    
            var intersections2 = temps.rayCaster.intersectObjects(globals.tpSurfaces);
            if ( intersections2.length > 0 ) {
    
                var intersection2 = intersections2[ 0 ];
    
                //update 2nd half of arc line
                locals.curve.v2.copy(intersection2.point);
                locals.curve.v2.y = temps.rayCaster.ray.origin.y;
                locals.curve.v3.copy(intersection2.point);

                //update arc mesh
                if(locals.arc){
                    setTpArc(locals.curve);
                    locals.arc.visible = true;
                }
    
                if(debugMode){
                    //update helper arrow for 2nd ray
                    locals.helpers[1].setLength(intersection2.distance);
                }
    
                //update ghost position
                state.teleportPoint = intersection2.point;
                locals.ghost.position.copy(intersection2.point);
    
                //get thumbstick angle
                var stickAngle = utils.getAngleBetweenPoints(constants.origin, thumbstickVal);
                //get controller angle
                var contAngle = temps.euler.setFromRotationMatrix(temps.matrix).y;
                //get head angle
                // var headAngle = utils.getWorldRotation(globals.renderer.xr.getCamera(globals.camera), y, temps.euler);
                // drawDebugToCanvas({head: headAngle});
    
                //update ghost rotation
                locals.ghost.rotation.y = -stickAngle + contAngle;

                locals.ghost.visible = true;
    
    
            }else{
                state.teleportPoint = null;
            }
    
        } else {
            state.teleportPoint = null;
        }
    }

    locals.teleportEnd = teleportEnd;
    function teleportEnd(){
        locals.ghost.visible = false;
        locals.arc.visible = false;
        if (debugMode){
            //hide helpers
            locals.helpers[0].visible = false;
            locals.helpers[1].visible = false;
            locals.helpers[2].visible = false;
        }
    
        if(state.teleportPoint){
            // get head angle
            // This creates an offset to aacount for the user physically turning around,
            // and thus no longer lining up with the globals.player object.
            var headAngle = utils.getWorldRotation(globals.renderer.xr.getCamera(globals.camera), constants.y, temps.euler).y;
            var playerAngle = utils.getWorldRotation(globals.player, constants.y, temps.euler).y;
            var offset = headAngle - playerAngle;
    
    
            //teleport globals.player to new position and rotation
            globals.player.position.copy(locals.ghost.position);
            globals.player.rotation.y = locals.ghost.rotation.y - offset;
    
            if(debugMode){
                //update debug ghost to match globals.player object
                locals.debugGhost.position.copy(globals.player.position);
                locals.debugGhost.quaternion.copy(globals.player.quaternion);
            }
            
        }
    }

    function setTpArc(curve){
        var points = curve.getPoints(20);
        var i = 0;
        var currBone = locals.arc.getObjectByName('rootBone');
        locals.arc.position.copy(points[0]);
        currBone.position.set(0,0,0);
    
        currBone = currBone.children[0];
        
        while(currBone && i < points.length){
            
            temps.vector.subVectors(points[i - 1] || points[i], points[i]);
            currBone.position.copy(temps.vector);
    
            currBone = currBone.children[0];
            i++;
        }
    }

    locals.flickTurn = flickTurn;
    function flickTurn(dir){
        var direction = (dir > 0)? -1 : 1;
    
        globals.player.rotateOnWorldAxis(constants.y, Math.PI / 15 * direction);
    }

    locals.handleInput = handleInput;
    function handleInput(selectorObj, thumbstick){
        //the tpend condition must come before the tpstart condition, otherwise the last thumbstick position may be invalid
        if(Math.abs(thumbstick.y) < 0.1 && Math.abs(thumbstick.x) < 0.1){
            if(state.teleporting){
                teleportEnd();
            }
            state.teleporting = false;
        }
        if(thumbstick.y < -0.9 || state.teleporting){
            state.teleporting = true;
            teleportStart(selectorObj, thumbstick);
        }
        if(Math.abs(thumbstick.x) > 0.7){
            if(!state.teleporting && !state.flickTurning){
                state.flickTurning = true;
                flickTurn(thumbstick.x);
            }	
        }else{
            state.flickTurning = false;
        }
    }

    function loadModel(loader, url){
        return new Promise((resolve, reject)=>{
            loader.load(
                url,
                function ( gltf ) { 
                    console.log(`loaded ${url}`, gltf); 
                    resolve(gltf); },
                null,
                function ( e ) { 
                    console.log(`failed to load ${url}`, e); 
                    reject(e); 
                }
            );
        })
    }

    return locals;
}