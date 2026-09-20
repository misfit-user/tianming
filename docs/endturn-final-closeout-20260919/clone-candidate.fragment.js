function _tmClonePersistenceData(value) {
  var seen = new Map();
  function clone(input) {
    if (input === null || typeof input !== 'object') {
      if (typeof input === 'function' || typeof input === 'symbol') throw new Error('native-clone-required');
      return input;
    }
    if (seen.has(input)) return seen.get(input);
    var array = Array.isArray(input), proto = Object.getPrototypeOf(input);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw new Error('native-clone-required');
    var output = array ? new Array(input.length) : {};
    seen.set(input, output);
    Object.keys(input).forEach(function(key) {
      var descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) throw new Error('native-clone-required');
      var copied = clone(descriptor.value);
      if (key === '__proto__') Object.defineProperty(output, key, { value: copied, writable: true, configurable: true, enumerable: true });
      else output[key] = copied;
    });
    return output;
  }
  try { return clone(value); } catch (_) { return deepClone(value); }
}
