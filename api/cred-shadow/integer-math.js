'use strict';

const {
  SCALE,
  EU,
  INT64_MIN,
  INT64_MAX,
  MAX_RECORDS_PER_SNAPSHOT,
  MAX_RAW_EVENT_MASS,
  MAX_CATEGORY_AGGREGATE_MASS,
} = require('./parameters');

const INT64_NEGATIVE_MAGNITUDE_LIMIT = 2n ** 63n;
const MAX_ROOT_DEGREE = 63;

function assertInt64(value, label = 'value') {
  if (typeof value !== 'bigint') throw new TypeError(`${label} must be a BigInt`);
  if (value < INT64_MIN || value > INT64_MAX) throw new RangeError(`${label} is outside int64 range`);
  return value;
}

function unsignedMagnitude(value) {
  return value < 0n ? -(value + 1n) + 1n : value;
}

function gcdMagnitude(left, right) {
  let a = left;
  let b = right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function gcd(left, right) {
  assertInt64(left, 'left');
  assertInt64(right, 'right');
  const result = gcdMagnitude(unsignedMagnitude(left), unsignedMagnitude(right));
  if (result > INT64_MAX) throw new RangeError('gcd result is outside int64 range');
  return result;
}

function roundDiv(numerator, denominator) {
  assertInt64(numerator, 'numerator');
  assertInt64(denominator, 'denominator');
  if (denominator <= 0n) throw new RangeError('denominator must be positive');

  let quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) return quotient;

  const remainderMagnitude = remainder < 0n ? -remainder : remainder;
  if (remainderMagnitude >= denominator - remainderMagnitude) {
    const adjustment = numerator < 0n ? -1n : 1n;
    if ((adjustment > 0n && quotient === INT64_MAX) ||
        (adjustment < 0n && quotient === INT64_MIN)) {
      throw new RangeError('rounded result is outside int64 range');
    }
    quotient += adjustment;
  }
  return assertInt64(quotient, 'rounded result');
}

function addModWithCarry(left, right, modulus) {
  if (left >= modulus - right) {
    return { remainder: left - (modulus - right), carry: 1n };
  }
  return { remainder: left + right, carry: 0n };
}

function checkedMagnitudeAdd(left, right, limit) {
  if (right > limit || left > limit - right) {
    throw new RangeError('mulDivRound result is outside int64 range');
  }
  return left + right;
}

function checkedMagnitudeDouble(value, limit) {
  if (value > limit - value) {
    throw new RangeError('mulDivRound result is outside int64 range');
  }
  return value + value;
}

function unsignedMulDiv(left, right, denominator, resultLimit) {
  const wholePerLeft = left / denominator;
  const remainderPerLeft = left % denominator;
  let quotient = 0n;
  let remainder = 0n;

  const bits = [];
  let multiplier = right;
  while (multiplier !== 0n) {
    bits.push(multiplier & 1n);
    multiplier >>= 1n;
  }

  for (let index = bits.length - 1; index >= 0; index -= 1) {
    quotient = checkedMagnitudeDouble(quotient, resultLimit);
    let modular = addModWithCarry(remainder, remainder, denominator);
    remainder = modular.remainder;
    quotient = checkedMagnitudeAdd(quotient, modular.carry, resultLimit);

    if (bits[index] === 1n) {
      quotient = checkedMagnitudeAdd(quotient, wholePerLeft, resultLimit);
      modular = addModWithCarry(remainder, remainderPerLeft, denominator);
      remainder = modular.remainder;
      quotient = checkedMagnitudeAdd(quotient, modular.carry, resultLimit);
    }
  }

  return { quotient, remainder };
}

function mulDivRound(left, right, denominator) {
  assertInt64(left, 'left');
  assertInt64(right, 'right');
  assertInt64(denominator, 'denominator');
  if (denominator <= 0n) throw new RangeError('denominator must be positive');
  if (left === 0n || right === 0n) return 0n;

  const negative = (left < 0n) !== (right < 0n);
  let leftMagnitude = unsignedMagnitude(left);
  let rightMagnitude = unsignedMagnitude(right);
  let reducedDenominator = denominator;

  let common = gcdMagnitude(leftMagnitude, reducedDenominator);
  leftMagnitude /= common;
  reducedDenominator /= common;
  common = gcdMagnitude(rightMagnitude, reducedDenominator);
  rightMagnitude /= common;
  reducedDenominator /= common;

  const resultLimit = negative ? INT64_NEGATIVE_MAGNITUDE_LIMIT : INT64_MAX;
  let { quotient, remainder } = unsignedMulDiv(
    leftMagnitude,
    rightMagnitude,
    reducedDenominator,
    resultLimit,
  );

  if (remainder !== 0n && remainder >= reducedDenominator - remainder) {
    quotient = checkedMagnitudeAdd(quotient, 1n, resultLimit);
  }

  if (negative) {
    if (quotient === INT64_NEGATIVE_MAGNITUDE_LIMIT) return INT64_MIN;
    return -quotient;
  }
  return quotient;
}

function checkedInt64Add(left, right, label) {
  assertInt64(left, `${label} left operand`);
  assertInt64(right, `${label} right operand`);
  if (right > 0n && left > INT64_MAX - right) throw new RangeError(`${label} is outside int64 range`);
  if (right < 0n && left < INT64_MIN - right) throw new RangeError(`${label} is outside int64 range`);
  return left + right;
}

function decayFactor(ageDays, halfLifeDays) {
  assertInt64(ageDays, 'ageDays');
  assertInt64(halfLifeDays, 'halfLifeDays');
  if (ageDays < 0n || halfLifeDays <= 0n) throw new RangeError('invalid decay input');
  const denominator = checkedInt64Add(halfLifeDays, ageDays, 'decay denominator');
  return mulDivRound(SCALE, halfLifeDays, denominator);
}

function powerExceeds(base, degree, target) {
  let product = 1n;
  for (let exponent = 0; exponent < degree; exponent += 1) {
    if (base !== 0n && product > target / base) return true;
    product *= base;
  }
  return false;
}

function integerNthRoot(value, degree) {
  assertInt64(value, 'root operand');
  if (value < 0n) throw new RangeError('root operand must be nonnegative');
  if (!Number.isInteger(degree) || degree < 1 || degree > MAX_ROOT_DEGREE) {
    throw new RangeError(`root degree must be an integer from 1 to ${MAX_ROOT_DEGREE}`);
  }
  if (value < 2n || degree === 1) return value;

  let low = 0n;
  let high = value;
  while (low < high) {
    const distance = high - low;
    const midpoint = low + (distance / 2n) + (distance % 2n);
    if (powerExceeds(midpoint, degree, value)) high = midpoint - 1n;
    else low = midpoint;
  }
  return low;
}

function assertRecordCount(count) {
  if (!Number.isSafeInteger(count) || count < 0 || count > MAX_RECORDS_PER_SNAPSHOT) {
    throw new RangeError('record count exceeds snapshot bound');
  }
  return count;
}

function assertRawEventMass(mass) {
  assertInt64(mass, 'raw event mass');
  if (mass < 0n || mass > MAX_RAW_EVENT_MASS) {
    throw new RangeError('raw event mass exceeds event bound');
  }
  return mass;
}

function addAggregateMass(currentMass, additionalMass) {
  assertInt64(currentMass, 'current aggregate mass');
  assertInt64(additionalMass, 'additional aggregate mass');
  if (currentMass < 0n || additionalMass < 0n ||
      currentMass > MAX_CATEGORY_AGGREGATE_MASS ||
      additionalMass > MAX_CATEGORY_AGGREGATE_MASS - currentMass) {
    throw new RangeError('category aggregate mass exceeds aggregate bound');
  }
  return currentMass + additionalMass;
}

module.exports = Object.freeze({
  INT64_MIN,
  INT64_MAX,
  MAX_RECORDS_PER_SNAPSHOT,
  MAX_RAW_EVENT_MASS,
  MAX_CATEGORY_AGGREGATE_MASS,
  assertInt64,
  roundDiv,
  gcd,
  mulDivRound,
  decayFactor,
  integerNthRoot,
  assertRecordCount,
  assertRawEventMass,
  addAggregateMass,
});
