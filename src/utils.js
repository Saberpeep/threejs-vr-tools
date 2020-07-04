import { Matrix4, Euler, Vector3, Quaternion } from 'three';
var tempMatrix = new Matrix4();
var tempVectA = new Vector3();
var tempVectB = new Vector3();
var tempQuat = new Quaternion();
var tempEuler = new Euler();
function getWorldRotation(object, axis, euler){
    object.updateMatrixWorld();
    if (!euler){
        euler = tempEuler.clone();
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

function getAngleBetween3d(vectA, vectB, euler){
	tempVectA.copy(vectA).normalize();
	tempVectB.copy(vectB).normalize();
	tempQuat.setFromUnitVectors(tempVectA, tempVectB);

	if(!euler) euler = tempEuler.clone();
	euler.setFromQuaternion(tempQuat);
	return euler;
}

function localToWorld(obj, inVect, outVect, outMatrix){
	if (!outVect) outVect = new THREE.Vector3();
	if (!outMatrix) outMatrix = tempMatrix;

	//get rotation of main object
	obj.updateMatrixWorld();
	outMatrix.identity().extractRotation( obj.matrixWorld );
	//apply rotation to input vector
	tempVectA.copy(inVect).applyMatrix4( outMatrix );

	//get position of main object
	tempVectB.setFromMatrixPosition(obj.matrixWorld);

	//add rotated input vector to object world position
	outVect.addVectors(tempVectB, tempVectA);

	return outVect;
}

function copy(obj){
	return JSON.parse(JSON.stringify({val: obj})).val;
}

export default {copy: copy, getAngleBetweenPoints: getAngleBetweenPoints, getWorldRotation: getWorldRotation, getAngleBetween3d: getAngleBetween3d, localToWorld: localToWorld};