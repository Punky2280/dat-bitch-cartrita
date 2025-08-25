#!/usr/bin/env node

import { Pool } from 'pg';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: 'localhost', // Connect to localhost, not 'db' container
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT || 5432,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000), // Limit input length
    });
    return `[${response.data[0].embedding.join(',')}]`;
  } catch (error) {
    console.warn('Failed to generate embedding:', error.message);
    return null;
  }
}

// Manual sections to add from existing markdown files
const manualFiles = [
  {
    file: '/home/robbie/development/dat-bitch-cartrita/AGENT_MANUAL.md',
    sections: [
      {
        title: 'Complete Agent Directory',
        slug: 'agent-directory',
        section_type: 'reference',
        difficulty_level: 'intermediate',
        estimated_read_time: '15 minutes',
        tags: ['agents', 'directory', 'reference', 'capabilities'],
        is_featured: true,
        start_marker: '## 📋 Complete Agent Directory',
        end_marker: '## 🎯 Prompt Engineering Best Practices',
      },
      {
        title: 'Prompt Engineering Best Practices',
        slug: 'prompt-engineering',
        section_type: 'guide',
        difficulty_level: 'intermediate',
        estimated_read_time: '12 minutes',
        tags: ['prompting', 'best-practices', 'techniques', 'ai'],
        is_featured: true,
        start_marker: '## 🎯 Prompt Engineering Best Practices',
        end_marker: '## 🛠 Multi-Agent Tool Usage',
      },
      {
        title: 'Multi-Agent Tool Usage',
        slug: 'multi-agent-tools',
        section_type: 'tutorial',
        difficulty_level: 'advanced',
        estimated_read_time: '10 minutes',
        tags: ['multi-agent', 'tools', 'workflow', 'automation'],
        is_featured: false,
        start_marker: '## 🛠 Multi-Agent Tool Usage',
        end_marker: '## 📈 Advanced Prompting Strategies',
      },
      {
        title: 'Advanced Prompting Strategies',
        slug: 'advanced-prompting',
        section_type: 'tutorial',
        difficulty_level: 'expert',
        estimated_read_time: '8 minutes',
        tags: ['prompting', 'advanced', 'strategies', 'expert'],
        is_featured: false,
        start_marker: '## 📈 Advanced Prompting Strategies',
        end_marker: '## 🎨 Creative Combination Techniques',
      },
      {
        title: 'Creative Combination Techniques',
        slug: 'creative-combinations',
        section_type: 'tutorial',
        difficulty_level: 'advanced',
        estimated_read_time: '6 minutes',
        tags: ['creative', 'combinations', 'workflows', 'advanced'],
        is_featured: false,
        start_marker: '## 🎨 Creative Combination Techniques',
        end_marker: '## 🔧 Tool Integration Examples',
      },
      {
        title: 'Common Pitfalls and Solutions',
        slug: 'common-pitfalls',
        section_type: 'guide',
        difficulty_level: 'beginner',
        estimated_read_time: '5 minutes',
        tags: ['pitfalls', 'troubleshooting', 'common-issues', 'solutions'],
        is_featured: true,
        start_marker: '## ⚠️ Common Pitfalls and Solutions',
        end_marker: '## 🏆 Expert-Level Integration Patterns',
      },
      {
        title: 'Expert-Level Integration Patterns',
        slug: 'expert-integration',
        section_type: 'reference',
        difficulty_level: 'expert',
        estimated_read_time: '20 minutes',
        tags: ['expert', 'integration', 'patterns', 'advanced'],
        is_featured: false,
        start_marker: '## 🏆 Expert-Level Integration Patterns',
        end_marker: 'This comprehensive guide provides',
      },
    ],
  },
  {
    file: '/home/robbie/development/dat-bitch-cartrita/BACKEND_STRUCTURE.md',
    sections: [
      {
        title: 'Backend Directory Structure',
        slug: 'backend-structure',
        section_type: 'reference',
        difficulty_level: 'intermediate',
        estimated_read_time: '10 minutes',
        tags: ['backend', 'structure', 'architecture', 'organization'],
        is_featured: true,
        start_marker: '# Backend Structure Documentation',
        end_marker: '## 📊 **System Statistics**',
      },
      {
        title: 'System Statistics and Architecture',
        slug: 'system-statistics',
        section_type: 'reference',
        difficulty_level: 'beginner',
        estimated_read_time: '5 minutes',
        tags: ['statistics', 'architecture', 'overview', 'metrics'],
        is_featured: false,
        start_marker: '## 📊 **System Statistics**',
        end_marker: '## 🔧 **Key Architectural Decisions**',
      },
      {
        title: 'Architectural Decisions and Integration',
        slug: 'architectural-decisions',
        section_type: 'guide',
        difficulty_level: 'advanced',
        estimated_read_time: '8 minutes',
        tags: ['architecture', 'decisions', 'integration', 'design'],
        is_featured: false,
        start_marker: '## 🔧 **Key Architectural Decisions**',
        end_marker: '## ✅ **Structure Validation**',
      },
      {
        title: 'Structure Validation and Quality Assurance',
        slug: 'structure-validation',
        section_type: 'guide',
        difficulty_level: 'intermediate',
        estimated_read_time: '6 minutes',
        tags: ['validation', 'quality', 'maintenance', 'best-practices'],
        is_featured: false,
        start_marker: '## ✅ **Structure Validation**',
        end_marker: '### Monitoring Points',
      },
    ],
  },
  {
    file: '/home/robbie/development/dat-bitch-cartrita/packages/backend/OPENTELEMETRY_GUIDE.md',
    sections: [
      {
        title: 'OpenTelemetry Complete Implementation Guide',
        slug: 'opentelemetry-complete-guide',
        section_type: 'tutorial',
        difficulty_level: 'advanced',
        estimated_read_time: '25 minutes',
        tags: [
          'opentelemetry',
          'observability',
          'monitoring',
          'implementation',
        ],
        is_featured: true,
        full_file: true, // Use entire file content
      },
    ],
  },
];

async function extractSectionContent(filePath, startMarker, endMarker) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    if (!startMarker) {
      return content; // Return full file if no markers
    }

    const startIndex = content.indexOf(startMarker);
    if (startIndex === -1) {
      console.warn(`Start marker "${startMarker}" not found in ${filePath}`);
      return null;
    }

    let endIndex;
    if (endMarker) {
      endIndex = content.indexOf(endMarker, startIndex + startMarker.length);
      if (endIndex === -1) {
        endIndex = content.length; // Use rest of file if end marker not found
      }
    } else {
      endIndex = content.length;
    }

    return content.substring(startIndex, endIndex).trim();
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return null;
  }
}

async function convertManualFiles() {
  try {
    console.log('🚀 Starting manual files conversion...');

    let successCount = 0;
    let errorCount = 0;

    for (const fileInfo of manualFiles) {
      console.log(`\n📄 Processing file: ${path.basename(fileInfo.file)}`);

      for (const sectionInfo of fileInfo.sections) {
        try {
          console.log(`  📝 Processing section: ${sectionInfo.title}`);

          // Extract content
          let content;
          if (sectionInfo.full_file) {
            content = await extractSectionContent(fileInfo.file);
          } else {
            content = await extractSectionContent(
              fileInfo.file,
              sectionInfo.start_marker,
              sectionInfo.end_marker
            );
          }

          if (!content) {
            console.warn(
              `    ⚠️ Could not extract content for ${sectionInfo.title}`
            );
            errorCount++;
            continue;
          }

          // Generate embedding
          console.log('    🔗 Generating embedding...');
          const embeddingText = `${sectionInfo.title} ${content}`;
          const embedding = await generateEmbedding(embeddingText);

          // Insert or update in database
          const query = `
                        INSERT INTO user_manual_sections (
                            title, slug, content, section_type, difficulty_level,
                            estimated_read_time, tags, is_featured, version, embedding,
                            last_updated_by, search_keywords
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                        ) ON CONFLICT (slug) DO UPDATE SET
                            title = EXCLUDED.title,
                            content = EXCLUDED.content,
                            section_type = EXCLUDED.section_type,
                            difficulty_level = EXCLUDED.difficulty_level,
                            estimated_read_time = EXCLUDED.estimated_read_time,
                            tags = EXCLUDED.tags,
                            is_featured = EXCLUDED.is_featured,
                            embedding = EXCLUDED.embedding,
                            search_keywords = EXCLUDED.search_keywords,
                            updated_at = NOW()
                    `;

          const searchKeywords = `${sectionInfo.title} ${sectionInfo.tags.join(
            ' '
          )} ${content.substring(0, 200)}`;

          const values = [
            sectionInfo.title,
            sectionInfo.slug,
            content,
            sectionInfo.section_type,
            sectionInfo.difficulty_level,
            sectionInfo.estimated_read_time,
            sectionInfo.tags,
            sectionInfo.is_featured,
            '1.0',
            embedding,
            'File Conversion Script',
            searchKeywords,
          ];

          await pool.query(query, values);
          successCount++;
          console.log(`    ✅ Successfully added: ${sectionInfo.title}`);
        } catch (error) {
          console.error(
            `    ❌ Failed to process section "${sectionInfo.title}":`,
            error.message
          );
          errorCount++;
        }
      }
    }

    console.log(`\n📊 Conversion Summary:`);
    console.log(`✅ Successfully converted: ${successCount} sections`);
    console.log(`❌ Errors: ${errorCount} sections`);

    // Add some additional helpful manual sections
    console.log(`\n📚 Adding additional manual sections...`);

    const additionalSections = [
      {
        title: 'API Authentication Guide',
        slug: 'api-authentication',
        content: `# API Authentication Guide

Cartrita uses JWT (JSON Web Token) based authentication for secure API access.

## Getting Your API Token

1. **Login**: Sign into your Cartrita account
2. **Settings**: Navigate to User Settings → API Access
3. **Generate Token**: Click "Generate New API Token"
4. **Store Safely**: Save your token securely (it won't be shown again)

## Using the API Token

### HTTP Headers
Include your token in the Authorization header:

\`\`\`
Authorization: Bearer your_jwt_token_here
\`\`\`

### Example API Calls

\`\`\`javascript
// JavaScript example
const response = await fetch('/api/workflow-tools/search?q=security', {
    headers: {
        'Authorization': 'Bearer ' + yourToken,
        'Content-Type': 'application/json'
    }
});
\`\`\`

\`\`\`bash
# cURL example  
curl -H "Authorization: Bearer your_jwt_token" \\
     -H "Content-Type: application/json" \\
     https://your-cartrita-instance/api/workflow-tools/trending
\`\`\`

## Token Security

- **Never commit** tokens to version control
- **Use environment variables** to store tokens
- **Rotate tokens regularly** (every 90 days recommended)
- **Revoke unused tokens** in your settings

## Token Expiration

- Tokens expire after 24 hours by default
- You'll receive a 401 Unauthorized if expired
- Refresh tokens automatically or request new ones

## Rate Limits

- **Standard**: 1000 requests per hour
- **Premium**: 5000 requests per hour
- Rate limit headers included in responses`,
        section_type: 'guide',
        difficulty_level: 'beginner',
        estimated_read_time: '5 minutes',
        tags: ['api', 'authentication', 'jwt', 'security'],
        is_featured: true,
        version: '1.0',
      },
      {
        title: 'Workflow Tools API Reference',
        slug: 'workflow-tools-api',
        content: `# Workflow Tools API Reference

Complete reference for accessing and managing workflow tools via API.

## Endpoints

### GET /api/workflow-tools/search
Search workflow tools with advanced filters.

**Parameters:**
- \`q\` (string): Search query
- \`limit\` (number): Results per page (default: 20)
- \`offset\` (number): Pagination offset (default: 0)
- \`category_id\` (number): Filter by category
- \`tool_type\` (string): Filter by type
- \`complexity_level\` (string): Filter by complexity
- \`embedding\` (string): Base64 encoded embedding for semantic search

**Response:**
\`\`\`json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "title": "Code Linter and Formatter",
            "description": "Automatically lint and format code...",
            "category_name": "Development",
            "complexity_level": "intermediate",
            "estimated_time": "5-10 minutes",
            "tags": ["code-quality", "formatting"],
            "similarity_score": 0.87
        }
    ],
    "pagination": {
        "limit": 20,
        "offset": 0,
        "total": 1
    }
}
\`\`\`

### GET /api/workflow-tools/trending
Get popular/trending workflow tools.

**Parameters:**
- \`limit\` (number): Number of tools to return (default: 10)

### GET /api/workflow-tools/:id
Get detailed information about a specific tool.

### GET /api/workflow-tools/categories
Get all available categories.

### POST /api/workflow-tools (Authentication Required)
Add a new workflow tool.

### GET /api/workflow-tools/user/favorites (Authentication Required)
Get user's favorite tools and manual sections.

## Manual Sections API

### GET /api/workflow-tools/manual/search
Search manual sections.

**Parameters:**
- \`q\` (string): Search query  
- \`section_type\` (string): Filter by section type
- \`difficulty_level\` (string): Filter by difficulty

### POST /api/workflow-tools/manual (Authentication Required)
Add a new manual section.

## Error Handling

All endpoints return consistent error responses:

\`\`\`json
{
    "success": false,
    "message": "Error description"
}
\`\`\`

Common HTTP status codes:
- \`200\`: Success
- \`400\`: Bad Request (invalid parameters)
- \`401\`: Unauthorized (invalid/expired token)
- \`403\`: Forbidden (insufficient permissions)
- \`404\`: Not Found
- \`500\`: Internal Server Error`,
        section_type: 'reference',
        difficulty_level: 'intermediate',
        estimated_read_time: '10 minutes',
        tags: ['api', 'reference', 'workflow-tools', 'endpoints'],
        is_featured: false,
        version: '1.0',
      },
    ];

    for (const section of additionalSections) {
      try {
        // Generate embedding
        const embeddingText = `${section.title} ${section.content}`;
        const embedding = await generateEmbedding(embeddingText);

        const query = `
                    INSERT INTO user_manual_sections (
                        title, slug, content, section_type, difficulty_level,
                        estimated_read_time, tags, is_featured, version, embedding,
                        last_updated_by
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
                    ) ON CONFLICT (slug) DO UPDATE SET
                        content = EXCLUDED.content,
                        embedding = EXCLUDED.embedding,
                        updated_at = NOW()
                `;

        const values = [
          section.title,
          section.slug,
          section.content,
          section.section_type,
          section.difficulty_level,
          section.estimated_read_time,
          section.tags,
          section.is_featured,
          section.version,
          embedding,
          'Additional Content Script',
        ];

        await pool.query(query, values);
        console.log(`✅ Added additional section: ${section.title}`);
        successCount++;
      } catch (error) {
        console.error(
          `❌ Failed to add additional section "${section.title}":`,
          error.message
        );
        errorCount++;
      }
    }

    console.log(`\n🎉 Final Summary:`);
    console.log(`✅ Total sections added: ${successCount}`);
    console.log(`❌ Total errors: ${errorCount}`);
  } catch (error) {
    console.error('❌ Conversion failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the conversion script
if (import.meta.url === `file://${process.argv[1]}`) {
  convertManualFiles();
}
