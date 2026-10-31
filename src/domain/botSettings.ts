export type BotSettings = {
  version: 1;
  treble: number;
  double: number;
  single: number;
};
export const defaultBotSettings: BotSettings = {
  version: 1,
  treble: 0.35,
  double: 0.3,
  single: 0.82,
};
export function checkedBotSettings(value: BotSettings): BotSettings {
  if (
    !value ||
    value.version !== 1 ||
    ['treble', 'double', 'single'].some((key) => {
      const probability = value[key as 'treble' | 'double' | 'single'];
      return (
        typeof probability !== 'number' ||
        !Number.isFinite(probability) ||
        probability < 0 ||
        probability > 1
      );
    })
  )
    throw new Error(
      'Custom opponent accuracy must be between 0% and 100% with settings version 1.',
    );
  return {
    version: 1,
    treble: value.treble,
    double: value.double,
    single: value.single,
  };
}
