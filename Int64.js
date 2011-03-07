/**
* Support for handling 64-bit int numbers in Javascript (node.js)
*
* JS Numbers are IEEE-754 binary double-precision floats, which limits the
* range of values that can be represented with integer precision to:
*
* 2^^53 <= N <= 2^53
*
* Int64 objects wrap a node Buffer that holds the 8-bytes of int64 data.  These
* objects operate directly on the buffer which means that if they are created
* using an existing buffer then setting the value will modify the Buffer, and
* vice-versa.
*
* For details about IEEE-754 see:
* http://en.wikipedia.org/wiki/Double_precision_floating-point_format
*/

// Useful masks and values for doing bit twiddling
var MASK31 =  0x7fffffff, VAL31 = 0x80000000;
var MASK32 =  0xffffffff, VAL32 = 0x100000000;

// Map for converting hex octets to strings
var _HEX = [], _PADHEX = [];
for (var i = 0; i < 256; i++) {
  _HEX[i] = (i > 0xF ? '' : '0') + i.toString(16);
}

//
// Int64
//

/**
* Constructor accepts the following arguments:
*
* new Int64(buffer[, offset=0]) - Existing Buffer with byte offset
* new Int64(string)             - Hex string (throws if n is outside int64 range)
* new Int64(number)             - Number (throws if n is outside int64 range)
* new Int64(hi, lo)             - Raw bits as two 32-bit values
*/
var Int64 = module.exports = function(a1, a2) {
  if (a1 instanceof Buffer) {
    this.buffer = a1;
    this.offset = a2 || 0;
  } else {
    this.buffer = this.buffer || new Buffer(8);
    this.offset = 0;
    this.setValue.apply(this, arguments);
  }
};


// Max integer value that JS can accurately represent
Int64.MAX_INT = Math.pow(2, 53);

// Min integer value that JS can accurately represent
Int64.MIN_INT = -Math.pow(2, 53);

Int64.prototype = {
  /**
  * Do in-place 2's compliment.  See
  * http://en.wikipedia.org/wiki/Two's_complement
  */
  _2scomp: function() {
    var b = this.buffer, o = this.offset, carry = 1;
    for (var i = o + 7; i >= o; i--) {
      var v = (b[i] ^ 0xff) + carry;
      b[i] = v & 0xff;
      carry = v >> 8;
    }
  },

  /**
  * Set the value:
  * setValue(string) - A hexidecimal string
  * setValue(number) - Number (throws if n is outside int64 range)
  * setValue(hi, lo) - Raw bits as two 32-bit values
  */
  setValue: function(hi, lo) {
    var negate = false;
    if (arguments.length == 1) {
      if (typeof(hi) == 'number') {
        // Simplify bitfield retrieval by using abs() value.  We restore sign
        // later
        negate = hi < 0;
        hi = Math.abs(hi);
        lo = hi % VAL32;
        hi = hi / VAL32;
        if (hi > VAL32) throw RangeError(hi  + ' is outside Int64 range');
        hi = hi | 0;
    } else if (typeof(hi) == 'string') {
        hi = (hi + '').replace(/^0x/, '');
        lo = hi.substr(-8);
        hi = hi.length > 8 ? hi.substr(0, hi.length - 8) : '';
        hi = parseInt(hi, 16);
        lo = parseInt(lo, 16);
      } else {
        throw Error(hi + ' must be a Number or String');
      }
    }

    // Technically we should throw if hi/lo is outside int32 range here, but
    // it's not worth the effort.

    // Copy bytes to buffer
    var b = this.buffer, o = this.offset;
    for (var i = 7; i >= 0; i--) {
      b[o+i] = lo & 0xff;
      lo = i == 4 ? hi : lo >>> 8;
    }

    // Restore sign of passed argument
    if (negate) this._2scomp();
  },

  /**
  * Convert to a JS Number. Returns +/-Infinity for values that can't be
  * represented to integer precision.
  */
  valueOf: function() {
    var b = this.buffer, o = this.offset;

    var negate = b[0] & 0x80, x = 0, carry = 1;
    for (var i = 0, ii = o + 7; i < 8; i++, ii--) {
      var v = b[ii];
      // Do a running 2's complement for negative numbers
      if (negate) {
        v = (v ^ 0xff) + carry;
        carry = v >> 8;
      }

      x += (v & 0xff) * Math.pow(256, i);
    }

    // Return Infinity if we've lost integer precision
    if (x >= Int64.MAX_INT) {
      return negate ? -Infinity : Infinity;
    }

    return negate ? -x : x;
  },

  /**
  * Return string value
  */
  toString: function(radix) {
    return this.valueOf().toString(radix || 10);
  },

  /**
  * Return a string showing the buffer octets, with MSB on the left.
  */
  toOctetString: function(sep) {
    var out = new Array(8);
    var b = this.buffer, o = this.offset;
    for (var i = 0; i < 8; i++) {
      out[i] = _HEX[b[o+i]];
    }
    return out.join(sep || '');
  },

  /**
  * Pretty output in console.log
  */
  inspect: function() {
    return '[Int64 value:' + this + ' octets:' + this.toOctetString(' ') + ']';
  }
};
