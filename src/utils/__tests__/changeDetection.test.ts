import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateDataFingerprint,
  detectChanges,
  hasCountChanged,
  hashItem,
  type DataFingerprint,
} from '../changeDetection';

describe('changeDetection', () => {
  describe('generateDataFingerprint', () => {
    it('generates consistent hash for same data', async () => {
      const data = [{ title: 'Test', link: 'http://example.com' }];
      const fp1 = await generateDataFingerprint(data);
      const fp2 = await generateDataFingerprint(data);

      expect(fp1.hash).toBe(fp2.hash);
      expect(fp1.itemCount).toBe(1);
    });

    it('generates different hash for different data', async () => {
      const data1 = [{ title: 'Test 1' }];
      const data2 = [{ title: 'Test 2' }];

      const fp1 = await generateDataFingerprint(data1);
      const fp2 = await generateDataFingerprint(data2);

      expect(fp1.hash).not.toBe(fp2.hash);
    });

    it('normalizes whitespace for consistent hashing', async () => {
      const data1 = [{ title: '  Test  ' }];
      const data2 = [{ title: 'Test' }];

      const fp1 = await generateDataFingerprint(data1);
      const fp2 = await generateDataFingerprint(data2);

      expect(fp1.hash).toBe(fp2.hash);
    });

    it('normalizes case for consistent hashing', async () => {
      const data1 = [{ title: 'TEST' }];
      const data2 = [{ title: 'test' }];

      const fp1 = await generateDataFingerprint(data1);
      const fp2 = await generateDataFingerprint(data2);

      expect(fp1.hash).toBe(fp2.hash);
    });

    it('handles empty data array', async () => {
      const fp = await generateDataFingerprint([]);

      expect(fp.hash).toBeTruthy();
      expect(fp.itemCount).toBe(0);
      expect(fp.sampleKeys).toEqual([]);
    });

    it('extracts sample keys from first item', async () => {
      const data = [
        { name: 'Test', price: '100', rating: '4.5' },
      ];

      const fp = await generateDataFingerprint(data);

      expect(fp.sampleKeys).toContain('name');
      expect(fp.sampleKeys).toContain('price');
      expect(fp.sampleKeys).toContain('rating');
    });

    it('produces same hash regardless of key order', async () => {
      const data1 = [{ a: '1', b: '2', c: '3' }];
      const data2 = [{ c: '3', a: '1', b: '2' }];

      const fp1 = await generateDataFingerprint(data1);
      const fp2 = await generateDataFingerprint(data2);

      expect(fp1.hash).toBe(fp2.hash);
    });

    it('produces same hash regardless of array item order', async () => {
      const data1 = [{ title: 'A' }, { title: 'B' }];
      const data2 = [{ title: 'B' }, { title: 'A' }];

      const fp1 = await generateDataFingerprint(data1);
      const fp2 = await generateDataFingerprint(data2);

      expect(fp1.hash).toBe(fp2.hash);
    });

    it('handles nested objects', async () => {
      const data = [
        {
          title: 'Test',
          details: { price: '100', stock: 'In Stock' } as any,
        },
      ];

      const fp = await generateDataFingerprint(data);

      expect(fp.hash).toBeTruthy();
      expect(fp.itemCount).toBe(1);
    });
  });

  describe('detectChanges', () => {
    let currentFp: DataFingerprint;

    beforeEach(async () => {
      const data = [{ title: 'Current Data' }];
      currentFp = await generateDataFingerprint(data);
    });

    it('identifies new data when no previous fingerprint', () => {
      const result = detectChanges(currentFp, undefined);

      expect(result.hasChanged).toBe(true);
      expect(result.changeType).toBe('new');
      expect(result.currentHash).toBe(currentFp.hash);
      expect(result.previousHash).toBeUndefined();
    });

    it('identifies unchanged data when hashes match', async () => {
      const sameFp = { ...currentFp };

      const result = detectChanges(currentFp, sameFp);

      expect(result.hasChanged).toBe(false);
      expect(result.changeType).toBe('unchanged');
    });

    it('identifies modified data when hashes differ', async () => {
      const previousFp = await generateDataFingerprint([{ title: 'Previous Data' }]);

      const result = detectChanges(currentFp, previousFp);

      expect(result.hasChanged).toBe(true);
      expect(result.changeType).toBe('modified');
      expect(result.previousHash).toBe(previousFp.hash);
      expect(result.currentHash).toBe(currentFp.hash);
    });

    it('calculates added count when items increased', async () => {
      const previousFp: DataFingerprint = {
        hash: 'old-hash',
        itemCount: 5,
        timestamp: new Date().toISOString(),
        sampleKeys: [],
      };

      const currentFpLarger: DataFingerprint = {
        hash: 'new-hash',
        itemCount: 10,
        timestamp: new Date().toISOString(),
        sampleKeys: [],
      };

      const result = detectChanges(currentFpLarger, previousFp);

      expect(result.addedCount).toBe(5);
      expect(result.removedCount).toBe(0);
    });

    it('calculates removed count when items decreased', async () => {
      const previousFp: DataFingerprint = {
        hash: 'old-hash',
        itemCount: 10,
        timestamp: new Date().toISOString(),
        sampleKeys: [],
      };

      const currentFpSmaller: DataFingerprint = {
        hash: 'new-hash',
        itemCount: 7,
        timestamp: new Date().toISOString(),
        sampleKeys: [],
      };

      const result = detectChanges(currentFpSmaller, previousFp);

      expect(result.addedCount).toBe(0);
      expect(result.removedCount).toBe(3);
    });
  });

  describe('hasCountChanged', () => {
    it('returns true when no previous fingerprint', () => {
      expect(hasCountChanged(5, undefined)).toBe(true);
    });

    it('returns true when counts differ', () => {
      const previousFp: DataFingerprint = {
        hash: 'some-hash',
        itemCount: 10,
        timestamp: new Date().toISOString(),
        sampleKeys: [],
      };

      expect(hasCountChanged(15, previousFp)).toBe(true);
    });

    it('returns false when counts are same', () => {
      const previousFp: DataFingerprint = {
        hash: 'some-hash',
        itemCount: 10,
        timestamp: new Date().toISOString(),
        sampleKeys: [],
      };

      expect(hasCountChanged(10, previousFp)).toBe(false);
    });
  });

  describe('hashItem', () => {
    it('generates hash for single item', async () => {
      const item = { title: 'Test', link: 'http://example.com' };
      const hash = await hashItem(item);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 hex length
    });

    it('generates consistent hash for same item', async () => {
      const item = { title: 'Test' };

      const hash1 = await hashItem(item);
      const hash2 = await hashItem(item);

      expect(hash1).toBe(hash2);
    });

    it('generates different hash for different items', async () => {
      const item1 = { title: 'Test 1' };
      const item2 = { title: 'Test 2' };

      const hash1 = await hashItem(item1);
      const hash2 = await hashItem(item2);

      expect(hash1).not.toBe(hash2);
    });
  });
});
