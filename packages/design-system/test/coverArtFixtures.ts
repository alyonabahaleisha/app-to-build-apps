// 12 fixed cover-art fixture inputs — one per (stance, palette) combination.
// Covers all 2 stances × 6 palettes per ADR-0005 F-01 expansion to 12 fixtures.
//
// Seeds are arbitrary 32-char lowercase hex strings. Icon choices are archetype-
// canonical for readability but do not affect the shape of the determinism test.

import type {CoverArtInput} from '../src/coverArt.js'

export const COVER_ART_FIXTURES: ReadonlyArray<CoverArtInput & {name: string}> = [
  {
    name: 'productive-focus-list',
    stance: 'productive',
    palette: 'focus',
    icon: 'list',
    seed: '0a1b2c3d4e5f60718293a4b5c6d7e8f9',
  },
  {
    name: 'productive-health-dumbbell',
    stance: 'productive',
    palette: 'health',
    icon: 'dumbbell',
    seed: '1b2c3d4e5f607182a3b4c5d6e7f80910',
  },
  {
    name: 'productive-money-receipt',
    stance: 'productive',
    palette: 'money',
    icon: 'receipt',
    seed: '2c3d4e5f6071829304b5c6d7e8f90111',
  },
  {
    name: 'productive-social-users',
    stance: 'productive',
    palette: 'social',
    icon: 'users',
    seed: '3d4e5f6071829304a5b6c7d8e9fa0212',
  },
  {
    name: 'productive-learn-book',
    stance: 'productive',
    palette: 'learn',
    icon: 'book',
    seed: '4e5f6071829304a5b6c7d8e9faab1313',
  },
  {
    name: 'productive-play-rocket',
    stance: 'productive',
    palette: 'play',
    icon: 'rocket',
    seed: '5f6071829304a5b6c7d8e9faabbc1414',
  },
  {
    name: 'expressive-focus-target',
    stance: 'expressive',
    palette: 'focus',
    icon: 'target',
    seed: '6071829304a5b6c7d8e9faabbccd1515',
  },
  {
    name: 'expressive-health-leaf',
    stance: 'expressive',
    palette: 'health',
    icon: 'leaf',
    seed: '71829304a5b6c7d8e9faabbccdde1616',
  },
  {
    name: 'expressive-money-dollar',
    stance: 'expressive',
    palette: 'money',
    icon: 'dollar-sign',
    seed: '829304a5b6c7d8e9faabbccddee17170',
  },
  {
    name: 'expressive-social-heart',
    stance: 'expressive',
    palette: 'social',
    icon: 'heart',
    seed: '9304a5b6c7d8e9faabbccddeeff18180',
  },
  {
    name: 'expressive-learn-brain',
    stance: 'expressive',
    palette: 'learn',
    icon: 'brain',
    seed: 'a4b5c6d7e8f9aabbccddeeff00111919',
  },
  {
    name: 'expressive-play-camera',
    stance: 'expressive',
    palette: 'play',
    icon: 'camera',
    seed: 'b5c6d7e8f9aabbccddeeff0011222020',
  },
] as const
