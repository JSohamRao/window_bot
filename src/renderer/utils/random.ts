export interface RandomSource {
  next(): number;
}

export interface WeightedChoice<Value> {
  value: Value;
  weight: number;
}

export const mathRandomSource: RandomSource = {
  next: () => Math.random()
};

const sample = (random: RandomSource): number => {
  const value = random.next();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("RandomSource.next() must return a value in [0, 1). ");
  }
  return value;
};

export const randomBetween = (
  random: RandomSource,
  minimum: number,
  maximum: number
): number => {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum < minimum) {
    throw new RangeError("randomBetween requires finite bounds with maximum >= minimum.");
  }
  return minimum + sample(random) * (maximum - minimum);
};

export const weightedChoice = <Value>(
  random: RandomSource,
  choices: readonly WeightedChoice<Value>[]
): Value => {
  if (choices.length === 0) {
    throw new RangeError("weightedChoice requires at least one choice.");
  }

  const totalWeight = choices.reduce((total, choice) => {
    if (!Number.isFinite(choice.weight) || choice.weight < 0) {
      throw new RangeError("Choice weights must be finite nonnegative numbers.");
    }
    return total + choice.weight;
  }, 0);
  if (totalWeight <= 0) {
    throw new RangeError("weightedChoice requires at least one positive weight.");
  }
  const target = sample(random) * totalWeight;
  let cumulativeWeight = 0;

  for (const choice of choices) {
    cumulativeWeight += choice.weight;
    if (target < cumulativeWeight) {
      return choice.value;
    }
  }

  return choices[choices.length - 1].value;
};
