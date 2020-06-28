import { Matrix4, Euler } from 'three';
var tempMatrix = new Matrix4();
var tempEuler;
function getWorldRotation(object, axis, euler){
    object.updateMatrixWorld();
    if (!euler){
        if (!tempEuler){
            console.warn('making new temp euler, you should only see this once');
            tempEuler = new Euler();
        }
        euler = tempEuler;
    }
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

function getAngleBetweenPoints(p1, p2, a = 'x', b = 'y'){
    return Math.atan2(p2[b] - p1[b], p2[a] - p1[a]) + Math.PI / 2; 
    //returns radians (...* 180 / Math.PI for degrees)
    //adding pi to offset ouput into positive range (0-360)
}

function copy(obj){
	return JSON.parse(JSON.stringify({val: obj})).val;
}

export default {copy: copy, getAngleBetweenPoints: getAngleBetweenPoints, getWorldRotation: getWorldRotation};