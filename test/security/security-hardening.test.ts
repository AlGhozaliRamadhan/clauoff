import { describe, it, expect } from 'vitest';
import path from 'path';
import { sanitizeSkillName, serializeSkillMarkdown } from '@/lib/skills/parser';
import { resolveSafeSkillPath } from '@/lib/skills/storage';
import { sanitizePluginId, resolveSafePluginPath } from '@/lib/plugins/storage';
import { toToolResultsTag } from '@/lib/agent/tool-parser';
import { cleanTitle } from '@/lib/utils/title-utils';
import { cleanTextForSpeech } from '@/lib/audio/text-cleaner';
import { htmlToReadableMarkdown } from '@/lib/web-search';

describe('security-hardening', () => {
  it('safely resolves valid skill paths', () => {
    const base = path.resolve(process.cwd(), 'data', 'skills');
    const safe = resolveSafeSkillPath(base, 'my-skill', 'SKILL.md');
    expect(safe.startsWith(base)).toBe(true);
  });

  it('throws on path traversal in skills', () => {
    const base = path.resolve(process.cwd(), 'data', 'skills');
    expect(() => resolveSafeSkillPath(base, '../../../etc/passwd')).toThrow(/path traversal/i);
  });

  it('throws on path traversal in plugins', () => {
    const base = path.resolve(process.cwd(), 'data', 'plugins');
    expect(() => resolveSafePluginPath(base, '../sensitive.json')).toThrow(/path traversal/i);
  });

  it('sanitizes skill and plugin namer', () => {
    expect(sanitizeSkillName('../../../hack-skill')).toBe('hack-skill');
    expect(sanitizeSkillName('---bad---name---')).toBe('bad-name');
    expect(sanitizePluginId('../../plugin-123')).toBe('plugin-123');
  });

  it('handles repetition without ReDoS hang', () => {
    const huge = '-'.repeat(10000) + 'safe' + '-'.repeat(10000);
    const s = Date.now();
    const sanitized = sanitizeSkillName(huge);
    expect(Date.now() - s).toBeLessThan(100);
    expect(sanitized).toBe('safe');
  });

  it('escapes quotes in tool results tag', () => {
    const tag = toToolResultsTag({
      name: 'test',
      label: 'Search "><script>alert(1)</script>',
      status: 'success',
      items: [{ title: 'Item "1"', url: 'https://example.com' }],
    });
    expect(tag).not.toContain('<script>');
    expect(tag).toContain('&quot;&gt;&lt;script&gt;');
  });

  it('cleans titles and collapses nested tags', () => {
    const malicious = 'Fixing <scr<script>ipt>alert(1)</script> vulnerability';
    const cleaned = cleanTitle(malicious);
    expect(cleaned).not.toContain('<script>');
    expect(cleaned).not.toContain('<');
    expect(cleaned).not.toContain('>');
    expect(cleaned).toContain('vulnerability');
  });

  it('strips malicious nested tags in audio text cleaner', () => {
    const malicious = 'Hello <script>alert(1)</script> world <style>body{}</style>';
    const cleaned = cleanTextForSpeech(malicious);
    expect(cleaned).not.toContain('<script>');
    expect(cleaned).not.toContain('<style>');
    expect(cleaned).not.toContain('body{}');
    expect(cleaned).toBe('Hello world');
  });

  it('strips script tags with trailing whitespace in closing tags', () => {
    const html = '<div>Content</div><script src="evil.js" ></script ><style >body{color:red;}</style >';
    const md = htmlToReadableMarkdown(html);
    expect(md).not.toContain('script');
    expect(md).not.toContain('style');
    expect(md).toContain('Content');
  });

  it('does not double-unescape HTML entities', () => {
    const html = 'Code: &amp;lt;script&amp;gt;';
    const md = htmlToReadableMarkdown(html);
    expect(md).toContain('&lt;script&gt;');
    expect(md).not.toContain('<script>');
  });

  it('escapes backslashes and quotes in skill metadata', () => {
    const serialized = serializeSkillMarkdown({
      name: 'test-skill',
      description: 'A test with "quotes" and \\backslashes\\',
      metadata: {
        path: 'C:\\Users\\test\\"mspath"',
      },
      instructions: 'Do work',
    });
    expect(serialized).toContain('\\\\backslashes\\\\');
    expect(serialized).toContain('\\"quotes\\"');
  });
});
