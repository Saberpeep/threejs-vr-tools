import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import constants from './constants.js';
import utils from './utils.js';

export default function Interactables(globals){

    //globals
    //renderer, scene, camera, player

    var root = this;
    
    var temps = {
        //vector, matrix, euler, etc.
        vector: new THREE.Vector3(),
        vector2: new THREE.Vector3(),
        matrix: new THREE.Matrix4(),
        euler: new THREE.Euler(),
        rayCaster: new THREE.Raycaster(),
        arrowHelper: new THREE.ArrowHelper(constants.x, constants.origin, 5, 0x0000ff),
    }

    // init()
    // function init(){
    //     var required = ['renderer', 'scene', 'camera', 'player'];
    //     if (!globals){
    //         throw new Error(`Interactables ${required.join(', ')} from your scope`);
    //     }
    //     for (var key of required){
    //         if (!globals[key]){
    //             throw new Error(`Interactables requires ${key} from your scope`);
    //         }
    //     }
    // }

    this.Button = class Button extends THREE.Group {//function Button(config){
        // config = {
        //     object: THREE.Object3D, //button head
        //     axis: THREE.Vector3, //local axis to travel along
        //     throwLength: Number, //distance it can be pressed in
        //     restPosition: THREE.Vector3, //local position that button returns to
        // }
        constructor(config){
            super();
            this.type = "Button";
            this.plunger = config.plunger;
            this.axis = config.axis || constants.y;
            this.throwLength = config.throwLength || 0.1;
            this.restPosition = config.restPosition || this.plunger.position.clone();
            this.offset = config.offset || new THREE.Vector3();
            this.deadZone = config.deadZone || 0.5;    
            this.pressed = false;
            this.updateMatrixWorld();
            this.plunger.updateMatrixWorld();
        }

        update(gripObj){
            //check overall distance
            this.pressed = false;
            var pos = temps.vector.addVectors(this.getWorldPosition(temps.vector), this.offset);
            var gripPos = gripObj.getWorldPosition(temps.vector2);
            this.pressed = gripPos;
            var newPos = this.restPosition;
            if (pos.distanceTo(gripPos) <= this.throwLength * 2){
                console.log("distance met!", pos.distanceTo(gripPos), this.throwLength);
                var rayCaster = temps.rayCaster;
                //if we are pretty close, check more accurately with a rayCaster
                temps.matrix.identity().extractRotation( this.matrixWorld );

                rayCaster.ray.origin.copy(pos);
                rayCaster.ray.direction.copy(this.axis).applyMatrix4( temps.matrix );
                rayCaster.far = this.throwLength;

                temps.arrowHelper.position.copy(rayCaster.ray.origin);
                temps.arrowHelper.setDirection(rayCaster.ray.direction);
                temps.arrowHelper.setLength(1);
                console.log('ray:', rayCaster.ray.origin, rayCaster.ray.direction, rayCaster.far, this.axis, temps.matrix);
            
                var intersections = rayCaster.intersectObject( gripObj, true );
                if(intersections[0]){
                    newPos = temps.vector;
                    console.log("ray hit!", intersections[0]);
                    newPos.copy(this.restPosition);

                    if(intersections[0].distance < this.throwLength * this.deadZone){
                        newPos.addScaledVector(this.axis, -this.throwLength);
                        console.log("pressed!");
                        this.pressed = true;
                    }else{
                        console.log("pressing...");
                        newPos.addScaledVector(this.axis, -this.throwLength + intersections[0].distance); 
                    }
                }
            
            }
            this.plunger.position.copy(newPos);
            return this.pressed;
        }
    }


    return this;
}