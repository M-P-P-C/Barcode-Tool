import { describe, expect, it } from 'vitest';
import { splitMarkup } from './markup';

describe('[REQ-GS1-004] splitMarkup', () => {
  it('finds a wrong check digit', () => {
    expect(splitMarkup('(01)0950600013435|3|')).toEqual({
      before: '(01)0950600013435',
      bad: '3',
      after: '',
    });
  });

  it('handles a "|" that is itself the faulty character', () => {
    expect(splitMarkup('(99)1|||bad')).toEqual({ before: '(99)1', bad: '|', after: 'bad' });
  });

  it('leaves text without markers alone', () => {
    expect(splitMarkup('(10)ABC')).toEqual({ before: '(10)ABC', bad: '', after: '' });
  });
});
