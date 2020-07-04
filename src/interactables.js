import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import constants from './constants.js';
import utils from './utils.js';
import { Vector3 } from 'three';

export default function Interactables(globals){

    //globals
    //renderer, scene, camera, player

    var root = this;
    
    var temps = {
        //vector, matrix, euler, etc.
        vector: new THREE.Vector3(),
        vector2: new THREE.Vector3(),
        vector3: new THREE.Vector3(),
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

    this.Button = class Button extends THREE.Group {
        // config = {
        //     plunger: THREE.Object3D, //object3D representing the button head
        //     axis: THREE.Vector3, //local axis to travel along
        //     throwLength: Number, //distance it can be pressed in
        //     restPosition: THREE.Vector3, //local position that plunger returns to
        //     offset: THREE.Vector3, //local position offest to origin to tweak where the hand hits the button
        //     deadZone: Number, //min percent of throwlength that is required to be pressed before button snaps into on position
        // }
        constructor(config){
            super();
            this.type = "Button";
            this.plunger = config.plunger;
            this.axis = config.axis || constants.y.clone();
            this.throwLength = config.throwLength || 0.1;
            this.restPosition = config.restPosition || this.plunger.position.clone();
            this.offset = config.offset || new THREE.Vector3();
            this.deadZone = config.deadZone || 0.5;    
            this.pressed = false;
            this.updateMatrixWorld();
            this.plunger.updateMatrixWorld();
        }

        //to be called every frame, returns true or false to tell if button is pressed
        update(gripObj){
            
            this.pressed = false;
            var newPos = this.restPosition;

            var pos = utils.localToWorld(this, this.offset, temps.vector, temps.matrix);
            var gripPos = gripObj.getWorldPosition(temps.vector2);
            //check overall distance
            if (pos.distanceTo(gripPos) <= this.throwLength * 2){
                //if we are pretty close, check more accurately with a rayCaster
                console.log("distance met!", pos.distanceTo(gripPos), this.throwLength);

                var rayCaster = temps.rayCaster;

                rayCaster.ray.origin.copy(pos);
                rayCaster.ray.direction.copy(this.axis).applyMatrix4( temps.matrix ).normalize();
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

    this.Lever = class Lever extends THREE.Group {
        // config = {
        //     handlePos: Vector3, //The local position of the handle tht the user can grab.
        //     grabDistance: Number, //The min distance that the user's hand must be to the handle in order to grab it.
        //     axis: String, //'x','y', or 'z' - the local axis that the handle rotates around.
        //                   // The handle always rotates around its origin, position children accordingly.
        //     min: Number, //The max angle (in radians) that the lever is allowed to rotate to.
        //     max: Number, //The min angle (in radians) that the lever is allowed to rotate to.
        // }
        constructor(config){
            super();
            this.type = "Lever";
            this.handlePos = config.handlePos || new THREE.Vector3();
            this.axis = config.axis || 'y';
            this.min = config.min;
            this.max = config.max;
            this.grabDistance = config.grabDistance || 0.2;

            if(this.min !== undefined || this.max !== undefined){
                if(this.min == undefined || this.max == undefined){
                    throw new Error("must supply both min and max, or neither");
                }
                if (this.min > this.max){
                    throw new Error("min must be less than max");
                }
            }

            this.gripOffset = new THREE.Vector3(); //Stores the offest between the grip and the handle during grabbing, 
                                                   // so that the lever does not appear to snap to the user's hand

            //stores other two axes so that they can be used to address the right keys during 2D angle calculation
            this.rotationPlaneAxes = ['x','y','z'].filter(e=>{return e != this.axis});
            if (this.rotationPlaneAxes.length > 2){
                throw new Error("axis must be one of 'x','y', or 'z'");
            }
            //adjust euler order so that rotaion is accurate
            var eulerOrder = (this.axis + this.rotationPlaneAxes[0] + this.rotationPlaneAxes[1]).toUpperCase();
            this.rotation.reorder(eulerOrder);

            this.grabbed = false; //stores whether or not user is holding the handle

            this.updateMatrixWorld();
        }

        update(gripObj, gripping){
            
            //get hand and handle world positions
            this.updateMatrixWorld();
            var pos = utils.localToWorld(this, this.handlePos, temps.vector);
            var gripPos = gripObj.getWorldPosition(temps.vector2);
            //check hand distance to handle
            if (gripping && pos.distanceTo(gripPos) <= this.grabDistance && !this.grabbed){
                //user grabbed handle
                this.startAngle = utils.copy(this.rotation[this.axis]);
                this.gripOffset.subVectors(pos, gripPos);
                this.grabbed = true;
            
            }else if (!gripping){
                //user let go
                this.grabbed = false;
            }

            if(this.grabbed){
                //user is holding handle, update rotation to match
                this.getWorldPosition(temps.vector3).sub(gripPos).sub(this.gripOffset);
                var angle = -utils.getAngleBetweenPoints(constants.origin, temps.vector3, this.rotationPlaneAxes[0], this.rotationPlaneAxes[1]) - (Math.PI / 2) + (Math.PI * 2);

                //limit rotation
                if(this.min !== undefined && this.max !== undefined){
                    //Find the angle in the middle opposite side of rotation from the arc of valid rotation.
                    // Which side of this angle you are on determines which bound should be hit when you are not inside the valid range.
                    var avg = (this.max + this.min) / 2;
                    var opposite = (avg + Math.PI) % (Math.PI * 2);

                    //limit movement to valid range
                    if(angle <= this.min || angle >= opposite){
                        angle = utils.copy(this.min);
                    }else if(angle >= this.max){
                        angle = utils.copy(this.max);
                    }
                }
                
                this.rotation[this.axis] = angle ;
            }

            return this.grabbed;
        }
    }



    return this;
}