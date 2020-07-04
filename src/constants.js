import { Vector3 } from 'three';
export default {
    x: readOnlyIfy(new Vector3(1,0,0)),
    y: readOnlyIfy(new Vector3(0,1,0)),
    z: readOnlyIfy(new Vector3(0,0,1)),
    origin: readOnlyIfy(new Vector3(0,0,0)),
    negY: readOnlyIfy(new Vector3(0,-1,0)),
}

function readOnlyIfy(obj){
	return new Proxy(obj, {
		get: function(target, prop) {
			return target[prop];
        },
        set: ()=>{
            throw new Error('attempt to modify constant!');
        }
	})
}