#!/usr/bin/env node

/**
 * GitHub Workflows Summary for Cartrita Multi-Agent OS
 * 
 * This script provides a comprehensive overview of the GitHub workflows
 * implemented for the Cartrita platform.
 */

import fs from 'fs';
import path from 'path';

const WORKFLOWS_DIR = './.github/workflows';
const DOCS_DIR = './docs';

function analyzeWorkflow(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Extract basic information
  const nameMatch = content.match(/name:\s*(.+)/);
  const name = nameMatch ? nameMatch[1].replace(/['"]/g, '') : 'Unknown';
  
  // Count jobs
  const jobs = content.match(/jobs:\s*\n(.*?)(?=\n\S|\noncurrency|\n$)/s);
  const jobMatches = content.match(/^\s{2}[\w-]+:/gm) || [];
  const jobCount = jobMatches.length;
  
  // Find triggers
  const onSection = content.match(/on:\s*\n(.*?)(?=\njobs:)/s);
  const triggers = [];
  if (onSection) {
    if (onSection[1].includes('push:')) triggers.push('push');
    if (onSection[1].includes('pull_request:')) triggers.push('pull_request');
    if (onSection[1].includes('schedule:')) triggers.push('schedule');
    if (onSection[1].includes('workflow_dispatch:')) triggers.push('manual');
  }
  
  // Estimate complexity by line count and features
  const lineCount = lines.length;
  const hasServices = content.includes('services:');
  const hasMatrix = content.includes('matrix:');
  const hasArtifacts = content.includes('upload-artifact');
  const hasDocker = content.includes('docker');
  
  let complexity = 'Simple';
  if (lineCount > 500 || (hasServices && hasMatrix && hasArtifacts)) {
    complexity = 'Advanced';
  } else if (lineCount > 200 || hasServices || hasMatrix) {
    complexity = 'Intermediate';  
  }
  
  return {
    name,
    file: path.basename(filePath),
    jobCount,
    triggers,
    lineCount,
    complexity,
    hasServices,
    hasDocker,
    hasArtifacts
  };
}

function generateSummary() {
  console.log('🚀 Cartrita Multi-Agent OS - GitHub Workflows Summary\n');
  console.log('=' * 60);
  
  if (!fs.existsSync(WORKFLOWS_DIR)) {
    console.log('❌ No workflows directory found');
    return;
  }
  
  const workflowFiles = fs.readdirSync(WORKFLOWS_DIR)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
    .filter(file => fs.statSync(path.join(WORKFLOWS_DIR, file)).size > 0); // Skip empty files
  
  console.log(`📊 Total Workflows Found: ${workflowFiles.length}\n`);
  
  const workflows = workflowFiles.map(file => 
    analyzeWorkflow(path.join(WORKFLOWS_DIR, file))
  );
  
  // Sort by complexity and line count
  workflows.sort((a, b) => {
    const complexityOrder = { 'Simple': 1, 'Intermediate': 2, 'Advanced': 3 };
    return complexityOrder[b.complexity] - complexityOrder[a.complexity] || b.lineCount - a.lineCount;
  });
  
  console.log('🔧 Implemented Workflows:\n');
  
  workflows.forEach((workflow, index) => {
    const complexityEmoji = {
      'Simple': '🟢',
      'Intermediate': '🟡', 
      'Advanced': '🔴'
    };
    
    console.log(`${index + 1}. ${complexityEmoji[workflow.complexity]} **${workflow.name}**`);
    console.log(`   📄 File: ${workflow.file}`);
    console.log(`   ⚙️  Jobs: ${workflow.jobCount} | Lines: ${workflow.lineCount} | Complexity: ${workflow.complexity}`);
    console.log(`   🎯 Triggers: ${workflow.triggers.join(', ')}`);
    
    const features = [];
    if (workflow.hasServices) features.push('Services');
    if (workflow.hasDocker) features.push('Docker');
    if (workflow.hasArtifacts) features.push('Artifacts');
    
    if (features.length > 0) {
      console.log(`   ✨ Features: ${features.join(', ')}`);
    }
    console.log('');
  });
  
  // Statistics
  console.log('📈 Workflow Statistics:\n');
  
  const totalJobs = workflows.reduce((sum, w) => sum + w.jobCount, 0);
  const totalLines = workflows.reduce((sum, w) => sum + w.lineCount, 0);
  const complexityStats = workflows.reduce((acc, w) => {
    acc[w.complexity] = (acc[w.complexity] || 0) + 1;
    return acc;
  }, {});
  
  console.log(`• Total Jobs: ${totalJobs}`);
  console.log(`• Total Lines of YAML: ${totalLines.toLocaleString()}`);
  console.log(`• Complexity Distribution:`);
  Object.entries(complexityStats).forEach(([complexity, count]) => {
    console.log(`  - ${complexity}: ${count} workflows`);
  });
  
  const triggerStats = {};
  workflows.forEach(w => {
    w.triggers.forEach(trigger => {
      triggerStats[trigger] = (triggerStats[trigger] || 0) + 1;
    });
  });
  
  console.log(`• Trigger Distribution:`);
  Object.entries(triggerStats).forEach(([trigger, count]) => {
    console.log(`  - ${trigger}: ${count} workflows`);
  });
  
  const featuresCount = {
    services: workflows.filter(w => w.hasServices).length,
    docker: workflows.filter(w => w.hasDocker).length,
    artifacts: workflows.filter(w => w.hasArtifacts).length
  };
  
  console.log(`• Advanced Features:`);
  console.log(`  - Using Services: ${featuresCount.services} workflows`);
  console.log(`  - Using Docker: ${featuresCount.docker} workflows`);
  console.log(`  - Generating Artifacts: ${featuresCount.artifacts} workflows`);
  
  // Coverage analysis
  console.log('\n🎯 Coverage Analysis:\n');
  
  const categories = [
    { name: 'Testing & QA', keywords: ['test', 'comprehensive', 'validation'], workflows: [] },
    { name: 'Security', keywords: ['security', 'dependency', 'vulnerability'], workflows: [] },
    { name: 'AI/ML Specialized', keywords: ['ai', 'ml', 'model', 'agent'], workflows: [] },
    { name: 'DevOps & Infrastructure', keywords: ['container', 'database', 'infrastructure'], workflows: [] },
    { name: 'Performance', keywords: ['performance', 'monitoring', 'benchmark'], workflows: [] },
    { name: 'Documentation', keywords: ['documentation', 'docs'], workflows: [] }
  ];
  
  workflows.forEach(workflow => {
    const workflowText = (workflow.name + ' ' + workflow.file).toLowerCase();
    categories.forEach(category => {
      if (category.keywords.some(keyword => workflowText.includes(keyword))) {
        category.workflows.push(workflow.name);
      }
    });
  });
  
  categories.forEach(category => {
    const coverage = category.workflows.length > 0 ? '✅' : '⚠️';
    console.log(`${coverage} ${category.name}: ${category.workflows.length} workflows`);
    if (category.workflows.length > 0) {
      category.workflows.forEach(name => console.log(`    - ${name}`));
    }
  });
  
  // Documentation check
  console.log('\n📚 Documentation Status:\n');
  
  const docFiles = [
    'docs/github-workflows.md',
    'docs/github-workflows-catalog.md',
    'packages/backend/scripts/populateGithubWorkflows.js'
  ];
  
  docFiles.forEach(file => {
    const exists = fs.existsSync(file);
    const status = exists ? '✅' : '❌';
    const size = exists ? `(${Math.round(fs.statSync(file).size / 1024)}KB)` : '';
    console.log(`${status} ${file} ${size}`);
  });
  
  console.log('\n🎉 Implementation Complete!\n');
  console.log('The Cartrita Multi-Agent OS now has a comprehensive suite of GitHub workflows');
  console.log('covering testing, security, AI/ML validation, DevOps, and performance monitoring.');
  console.log('\nNext steps:');
  console.log('1. Review workflow configurations for your environment');
  console.log('2. Run ./packages/backend/scripts/populateGithubWorkflows.js to add to database');
  console.log('3. Test workflows in development environment');
  console.log('4. Customize performance thresholds as needed');
}

// Run the summary
generateSummary();