pliny.function({
  parent: "Live API",
  name: "colored",
  description: "Apply a color to a geometry, creating the intermediate material as necessary, and returning the resulting mesh",
  returns: "THREE.Mesh",
  parameters: [{ 
    name: "geometry", 
    type: "THREE.Geometry",
    description: "The geometry to which to apply the color." 
  }, { 
    name: "color", 
    type: "Number", 
    description: "A hexadecimal color value in RGB format." 
  }, { 
    name: "options",
    type: "Object",
    optional: true,
    description: "Optional settings for material properties."
  }, {
    name: "options.side",
    type: "Number",
    optional: true,
    default: "THREE.FrontSide",
    description: "Either THREE.FontSide, THREE.BackSide, or THREE.Both, for which side of the polygon should be shaded."
  }, {
    name: "options.opacity",
    type: "Number",
    optional: true,
    default: 1,
    description: "Make objects semi-transparent. Note: this usually doesn't work like you'd expect."
  }, {
    name: "options.roughness",
    type: "Number",
    optional: true,
    default: 0.5,
    description: "A value indicating the degree of light scattering the material causes."
  }, {
    name: "options.metalness",
    type: "Number",
    optional: true,
    default: 0,
    description: "A value indicating the degree of shininess the material causes."
  }, {
    name: "options.unshaded",
    type: "Boolean",
    optional: true,
    default: false,
    description: "Make objects not respond to lighting."
  }, {
    name: "options.wireframe",
    type: "Boolean",
    optional: true,
    default: false,
    description: "Draw objects as basic wireframes. Note: there's no control over the wire thickness. This should be considered a debugging feature, not a graphical feature."
  }]
});

import { Mesh } from "three/src/objects/Mesh";
import material from "./material";
export default function colored(geometry, color, options) {
  options = options || {};
  options.color = color;

  var mat = material("", options),
    obj = null;

  if (geometry.type.indexOf("Geometry") > -1) {
    obj = new Mesh(geometry, mat);
  }
  else if (geometry.isObject3D) {
    obj = geometry;
    obj.material = mat;
  }

  if(options.shadow){
    obj.receiveShadow = true;
    obj.castShadow = true;
  }

  if(options.resolve){
    options.resolve();
  }
  return obj;
};