// The GS1 engine marks the faulty part of an AI between "|" signs, for example
// "(01)0950600013435|3|" (wrong check digit) or "(99)1|||bad" (the "|" itself is not allowed).

export interface MarkedUp {
  before: string;
  bad: string;
  after: string;
}

/** Splits the engine's markup into the text before, the faulty part, and the text after. */
export function splitMarkup(markup: string): MarkedUp {
  const open = markup.indexOf('|');
  const close = markup.lastIndexOf('|');
  if (open === -1 || close === open) return { before: markup, bad: '', after: '' };
  return {
    before: markup.slice(0, open),
    bad: markup.slice(open + 1, close),
    after: markup.slice(close + 1),
  };
}
