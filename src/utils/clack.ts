import * as clack from '@clack/prompts';

export default clack;

export function isCancel(value: unknown): value is symbol {
  return clack.isCancel(value);
}
