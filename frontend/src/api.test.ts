import { describe, expect, it } from 'vitest';
import { validateActivityUrl } from './api';

describe('official activity URL validation', () => {
  it.each([
    ['allticket', 'https://allticket.com/event/example'],
    ['allticket', 'https://www.allticket.com/event/example'],
    ['ttm', 'https://www.thaiticketmajor.com/concert/example'],
  ] as const)('accepts %s official activity URL %s', (platform, url) => {
    expect(validateActivityUrl(url, platform)).toBeNull();
  });

  it.each([
    'http://www.allticket.com/event/example',
    'https://www.allticket.com.evil.example/event',
    'https://unknown.allticket.com/event/example',
    'https://user:password@www.allticket.com/event/example',
    'https://www.allticket.com:8443/event/example',
    'https://www.allticket.com/event/with space',
    'https://www.allticket.com\\@evil.example/event',
    'https://www.thaiticketmajor.com/event/example',
    'not a url',
  ])('rejects unsafe or unsupported URL %s', (url) => {
    expect(validateActivityUrl(url, 'allticket')).not.toBeNull();
  });
});
