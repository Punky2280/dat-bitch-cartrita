/**
 * Comprehensive Documentation Service
 * Manages and serves all project documentation
 */

import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';
import pg from 'pg';

class DocumentationService {
  constructor() {
    this.dbPool = null;
    this.isInitialized = false;
    this.documentationSources = new Map();
    this.processedDocs = new Map();
    this.searchIndex = new Map();
  }

  async initialize(dbPool) {
    if (this.isInitialized) return;

    try {
      console.log('[Documentation] Initializing Documentation Service...');

      this.dbPool = dbPool;

      // Define documentation sources
      this.documentationSources.set('AGENT_MANUAL.md', {
        path: '/home/robbie/development/dat-bitch-cartrita/AGENT_MANUAL.md',
        category: 'agents',
        title: 'Agent Manual',
        priority: 1,
      });

      this.documentationSources.set('BACKEND_STRUCTURE.md', {
        path: '/home/robbie/development/dat-bitch-cartrita/BACKEND_STRUCTURE.md',
        category: 'architecture',
        title: 'Backend Structure',
        priority: 2,
      });

      this.documentationSources.set('OPENTELEMETRY_GUIDE.md', {
        path: '/home/robbie/development/dat-bitch-cartrita/packages/backend/OPENTELEMETRY_GUIDE.md',
        category: 'monitoring',
        title: 'OpenTelemetry Guide',
        priority: 3,
      });

      this.documentationSources.set('CLAUDE.md', {
        path: '/home/robbie/development/dat-bitch-cartrita/CLAUDE.md',
        category: 'development',
        title: 'Claude Integration Guide',
        priority: 1,
      });

      this.documentationSources.set('README.md', {
        path: '/home/robbie/development/dat-bitch-cartrita/README.md',
        category: 'overview',
        title: 'Project Overview',
        priority: 1,
      });

      this.documentationSources.set('scripts/README.md', {
        path: '/home/robbie/development/dat-bitch-cartrita/scripts/README.md',
        category: 'scripts',
        title: 'Scripts Documentation',
        priority: 2,
      });

      this.documentationSources.set('USER_MANUAL.md', {
        path: '/home/robbie/development/dat-bitch-cartrita/packages/frontend/public/USER_MANUAL.md',
        category: 'user-guide',
        title: 'User Manual',
        priority: 1,
      });

      // Process all documentation files
      await this.processAllDocumentation();

      // Sync with database
      await this.syncWithDatabase();

      // Build search index
      await this.buildSearchIndex();

      this.isInitialized = true;
      console.log(
        '[Documentation] ✅ Documentation Service initialized with',
        this.processedDocs.size,
        'documents'
      );
    } catch (error) {
      console.error('[Documentation] ❌ Failed to initialize:', error);
      throw error;
    }
  }

  async processAllDocumentation() {
    for (const [filename, config] of this.documentationSources) {
      try {
        await this.processDocument(filename, config);
      } catch (error) {
        console.warn(
          `[Documentation] ⚠️ Could not process ${filename}:`,
          error.message
        );
      }
    }
  }

  async processDocument(filename, config) {
    try {
      const content = await fs.readFile(config.path, 'utf-8');
      const htmlContent = marked(content);

      // Extract metadata
      const metadata = this.extractMetadata(content);
      const sections = this.extractSections(content);
      const wordCount = content.split(/\s+/).length;

      const processedDoc = {
        filename,
        ...config,
        content: content,
        htmlContent: htmlContent,
        metadata,
        sections,
        wordCount,
        lastModified: (await fs.stat(config.path)).mtime,
        processedAt: new Date(),
      };

      this.processedDocs.set(filename, processedDoc);
      console.log(
        `[Documentation] ✅ Processed ${filename} (${wordCount} words, ${sections.length} sections)`
      );
    } catch (error) {
      console.error(`[Documentation] Failed to process ${filename}:`, error);
      throw error;
    }
  }

  extractMetadata(content) {
    const metadata = {
      title: null,
      author: null,
      version: null,
      lastUpdated: null,
      tags: [],
    };

    // Extract title from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
    }

    // Extract metadata from front matter or comments
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontMatterMatch) {
      const frontMatter = frontMatterMatch[1];
      const lines = frontMatter.split('\n');
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
          const value = valueParts.join(':').trim();
          metadata[key.trim().toLowerCase()] = value;
        }
      }
    }

    // Extract tags from content
    const tagMatches = content.match(/#([a-zA-Z][a-zA-Z0-9_-]*)/g);
    if (tagMatches) {
      metadata.tags = [...new Set(tagMatches.map(tag => tag.substring(1)))];
    }

    return metadata;
  }

  extractSections(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;
    let currentContent = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          level: headingMatch[1].length,
          title: headingMatch[2].trim(),
          anchor: this.generateAnchor(headingMatch[2].trim()),
          lineStart: i + 1,
          content: '',
        };
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    // Don't forget the last section
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      sections.push(currentSection);
    }

    return sections;
  }

  generateAnchor(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async syncWithDatabase() {
    if (!this.dbPool) return;

    try {
      for (const [filename, doc] of this.processedDocs) {
        await this.dbPool.query(
          `
                    INSERT INTO documentation (title, content, doc_type, category, tags, version, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT ON CONSTRAINT documentation_title_category_key DO UPDATE SET
                        content = EXCLUDED.content,
                        tags = EXCLUDED.tags,
                        version = EXCLUDED.version,
                        metadata = EXCLUDED.metadata,
                        updated_at = NOW()
                `,
          [
            doc.metadata.title || doc.title,
            doc.content,
            'manual',
            doc.category,
            doc.metadata.tags,
            doc.metadata.version || '1.0.0',
            JSON.stringify({
              filename,
              wordCount: doc.wordCount,
              sections: doc.sections.length,
              lastModified: doc.lastModified,
              processedAt: doc.processedAt,
            }),
          ]
        );
      }

      // Add unique constraint if it doesn't exist
      try {
        await this.dbPool.query(`
                    ALTER TABLE documentation 
                    ADD CONSTRAINT documentation_title_category_key 
                    UNIQUE (title, category)
                `);
      } catch (error) {
        // Constraint probably already exists
      }

      console.log('[Documentation] ✅ Synced documentation with database');
    } catch (error) {
      console.error('[Documentation] Failed to sync with database:', error);
    }
  }

  async buildSearchIndex() {
    for (const [filename, doc] of this.processedDocs) {
      const searchTerms = new Set();

      // Index title words
      if (doc.title) {
        doc.title.split(/\s+/).forEach(word => {
          const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanWord.length > 2) searchTerms.add(cleanWord);
        });
      }

      // Index content words
      const words = doc.content.split(/\s+/);
      for (const word of words) {
        const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanWord.length > 3) searchTerms.add(cleanWord);
      }

      // Index section titles
      for (const section of doc.sections) {
        section.title.split(/\s+/).forEach(word => {
          const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanWord.length > 2) searchTerms.add(cleanWord);
        });
      }

      // Build reverse index
      for (const term of searchTerms) {
        if (!this.searchIndex.has(term)) {
          this.searchIndex.set(term, []);
        }
        this.searchIndex.get(term).push({
          filename,
          title: doc.title,
          category: doc.category,
          relevance: 1,
        });
      }
    }

    console.log(
      '[Documentation] ✅ Built search index with',
      this.searchIndex.size,
      'terms'
    );
  }

  // Public API Methods
  getAllDocuments() {
    return Array.from(this.processedDocs.values()).map(doc => ({
      filename: doc.filename,
      title: doc.title,
      category: doc.category,
      wordCount: doc.wordCount,
      sections: doc.sections.length,
      lastModified: doc.lastModified,
      priority: doc.priority,
    }));
  }

  getDocument(filename) {
    return this.processedDocs.get(filename) || null;
  }

  getDocumentsByCategory(category) {
    return Array.from(this.processedDocs.values())
      .filter(doc => doc.category === category)
      .sort((a, b) => a.priority - b.priority);
  }

  searchDocuments(query, options = {}) {
    const limit = options.limit || 10;
    const category = options.category;

    const searchTerms = query
      .toLowerCase()
      .split(/\s+/)
      .map(term => term.replace(/[^a-z0-9]/g, ''))
      .filter(term => term.length > 2);

    const results = new Map();

    for (const term of searchTerms) {
      const matches = this.searchIndex.get(term) || [];
      for (const match of matches) {
        if (category && match.category !== category) continue;

        const key = match.filename;
        if (!results.has(key)) {
          results.set(key, {
            ...match,
            relevance: 0,
            matchedTerms: [],
          });
        }
        const result = results.get(key);
        result.relevance += 1;
        result.matchedTerms.push(term);
      }
    }

    return Array.from(results.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  getDocumentSections(filename, sectionLevel = null) {
    const doc = this.processedDocs.get(filename);
    if (!doc) return [];

    if (sectionLevel) {
      return doc.sections.filter(section => section.level === sectionLevel);
    }

    return doc.sections;
  }

  async getDocumentHTML(filename) {
    const doc = this.processedDocs.get(filename);
    if (!doc) return null;

    return {
      title: doc.title,
      category: doc.category,
      html: doc.htmlContent,
      metadata: doc.metadata,
      sections: doc.sections.map(section => ({
        level: section.level,
        title: section.title,
        anchor: section.anchor,
      })),
    };
  }

  // Statistics and Analytics
  async getDocumentationStats() {
    const stats = {
      totalDocuments: this.processedDocs.size,
      totalWords: 0,
      totalSections: 0,
      categoriesCount: new Set(),
      oldestDocument: null,
      newestDocument: null,
      avgWordsPerDoc: 0,
      categoryBreakdown: {},
    };

    let oldestDate = new Date();
    let newestDate = new Date(0);

    for (const doc of this.processedDocs.values()) {
      stats.totalWords += doc.wordCount;
      stats.totalSections += doc.sections.length;
      stats.categoriesCount.add(doc.category);

      // Category breakdown
      if (!stats.categoryBreakdown[doc.category]) {
        stats.categoryBreakdown[doc.category] = {
          count: 0,
          words: 0,
          sections: 0,
        };
      }
      stats.categoryBreakdown[doc.category].count++;
      stats.categoryBreakdown[doc.category].words += doc.wordCount;
      stats.categoryBreakdown[doc.category].sections += doc.sections.length;

      // Date tracking
      if (doc.lastModified < oldestDate) {
        oldestDate = doc.lastModified;
        stats.oldestDocument = doc.filename;
      }
      if (doc.lastModified > newestDate) {
        newestDate = doc.lastModified;
        stats.newestDocument = doc.filename;
      }
    }

    stats.categoriesCount = stats.categoriesCount.size;
    stats.avgWordsPerDoc = Math.round(stats.totalWords / stats.totalDocuments);

    return stats;
  }

  // Table of Contents Generation
  generateTableOfContents(filename, maxLevel = 3) {
    const doc = this.processedDocs.get(filename);
    if (!doc) return null;

    const toc = {
      title: doc.title,
      sections: [],
    };

    const stack = [toc.sections];

    for (const section of doc.sections) {
      if (section.level > maxLevel) continue;

      const tocEntry = {
        title: section.title,
        anchor: section.anchor,
        level: section.level,
        subsections: [],
      };

      // Find the right level to insert this section
      while (stack.length > section.level) {
        stack.pop();
      }

      while (stack.length < section.level) {
        if (stack[stack.length - 1].length > 0) {
          const lastSection =
            stack[stack.length - 1][stack[stack.length - 1].length - 1];
          if (!lastSection.subsections) lastSection.subsections = [];
          stack.push(lastSection.subsections);
        } else {
          break;
        }
      }

      stack[stack.length - 1].push(tocEntry);
    }

    return toc;
  }

  // Real-time documentation updates
  async watchForChanges() {
    // In a real implementation, you'd use fs.watch or chokidar
    console.log('[Documentation] File watching would be implemented here');
  }

  // Export documentation
  async exportDocumentation(format = 'json') {
    const exportData = {
      generatedAt: new Date(),
      totalDocuments: this.processedDocs.size,
      documents: {},
    };

    for (const [filename, doc] of this.processedDocs) {
      exportData.documents[filename] = {
        title: doc.title,
        category: doc.category,
        content: format === 'html' ? doc.htmlContent : doc.content,
        metadata: doc.metadata,
        sections: doc.sections,
        wordCount: doc.wordCount,
        lastModified: doc.lastModified,
      };
    }

    return exportData;
  }

  // Health check
  async healthCheck() {
    try {
      const stats = await this.getDocumentationStats();

      return {
        status: 'healthy',
        documents_loaded: stats.totalDocuments,
        search_terms_indexed: this.searchIndex.size,
        last_check: new Date(),
        categories: stats.categoriesCount,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        last_check: new Date(),
      };
    }
  }
}

export default DocumentationService;
