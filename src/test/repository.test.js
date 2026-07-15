import { describe, expect, it } from 'vitest';
import { resolveRepository } from '../lib/repository';

describe('resolveRepository', () => {
  it('derives owner and repo from a project Pages URL', () => {
    expect(
      resolveRepository({ hostname: 'alice.github.io', baseUrl: '/JapaneseWordbook/' }),
    ).toEqual({ owner: 'alice', repo: 'JapaneseWordbook', branch: 'main' });
  });

  it('follows the base path when a fork renames the repo', () => {
    expect(
      resolveRepository({ hostname: 'bob-2.github.io', baseUrl: '/kotoba/' }),
    ).toEqual({ owner: 'bob-2', repo: 'kotoba', branch: 'main' });
  });

  it('falls back to the upstream default off github.io (local dev)', () => {
    expect(
      resolveRepository({ hostname: 'localhost', baseUrl: '/JapaneseWordbook/' }),
    ).toEqual({ owner: 'Overture-2021', repo: 'JapaneseWordbook', branch: 'main' });
  });

  it('keeps the default repo when the base path is root', () => {
    expect(
      resolveRepository({ hostname: 'carol.github.io', baseUrl: '/' }),
    ).toEqual({ owner: 'carol', repo: 'JapaneseWordbook', branch: 'main' });
  });

  it('falls back cleanly with no arguments', () => {
    expect(resolveRepository()).toEqual({
      owner: 'Overture-2021',
      repo: 'JapaneseWordbook',
      branch: 'main',
    });
  });
});
