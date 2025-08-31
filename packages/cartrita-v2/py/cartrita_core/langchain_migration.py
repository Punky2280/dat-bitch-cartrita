#!/usr/bin/env python3
"""
Cartrita V2 - LangChain to OpenAI Responses API Migration Scripts
Automated migration utilities for transforming LangChain-based implementations
"""

import asyncio
import json
import os
import re
import ast
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional, Union, Tuple
from pathlib import Path
from dataclasses import dataclass, asdict
import shutil
from collections import defaultdict

try:
    import black
    BLACK_AVAILABLE = True
except ImportError:
    BLACK_AVAILABLE = False

try:
    import isort
    ISORT_AVAILABLE = True
except ImportError:
    ISORT_AVAILABLE = False


@dataclass
class MigrationRule:
    """Definition of a migration transformation rule"""
    name: str
    pattern: str
    replacement: str
    description: str
    category: str
    requires_manual_review: bool = False
    conditions: Dict[str, Any] = None


@dataclass
class MigrationResult:
    """Result of applying a migration rule"""
    rule_name: str
    file_path: str
    line_number: int
    original_code: str
    migrated_code: str
    success: bool
    error_message: Optional[str] = None
    requires_manual_review: bool = False


@dataclass
class FileMigration:
    """Complete migration result for a file"""
    file_path: str
    original_content: str
    migrated_content: str
    applied_rules: List[MigrationResult]
    backup_path: Optional[str] = None
    manual_review_required: bool = False
    migration_timestamp: str = None


class LangChainMigrator:
    """
    Comprehensive migration tool for converting LangChain code to OpenAI Responses API
    """
    
    def __init__(self, source_directory: str, backup_directory: str = None):
        self.source_directory = Path(source_directory)
        self.backup_directory = Path(backup_directory) if backup_directory else self.source_directory / "migration_backup"
        self.migration_rules = []
        self.logger = logging.getLogger(__name__)
        
        # Initialize migration rules
        self._init_migration_rules()
        
        # Statistics
        self.stats = {
            "files_processed": 0,
            "files_migrated": 0,
            "rules_applied": 0,
            "manual_reviews_required": 0,
            "errors": 0
        }
        
    def _init_migration_rules(self):
        """Initialize the migration rules for LangChain to OpenAI Responses API"""
        
        # Import transformations
        self.migration_rules.extend([
            MigrationRule(
                name="langchain_llms_import",
                pattern=r"from langchain\.llms import (\w+)",
                replacement="# Migrated: Replace with OpenAI client\nfrom openai import OpenAI",
                description="Replace LangChain LLM imports with OpenAI client",
                category="imports",
                requires_manual_review=True
            ),
            
            MigrationRule(
                name="langchain_chat_models_import",
                pattern=r"from langchain\.chat_models import (\w+)",
                replacement="# Migrated: Replace with OpenAI client\nfrom openai import OpenAI",
                description="Replace LangChain chat model imports with OpenAI client",
                category="imports",
                requires_manual_review=True
            ),
            
            MigrationRule(
                name="langchain_openai_import",
                pattern=r"from langchain\.llms\.openai import OpenAI as LangChainOpenAI",
                replacement="from openai import OpenAI",
                description="Direct OpenAI import replacement",
                category="imports"
            ),
            
            MigrationRule(
                name="langchain_chat_openai_import",
                pattern=r"from langchain\.chat_models\.openai import ChatOpenAI",
                replacement="from openai import OpenAI",
                description="ChatOpenAI import replacement",
                category="imports"
            ),
            
            MigrationRule(
                name="langchain_schema_import",
                pattern=r"from langchain\.schema import (.*)",
                replacement="# Migrated: Replace LangChain schema with custom types\n# from cartrita_core.schema_validator import \\1",
                description="Replace LangChain schema imports",
                category="imports",
                requires_manual_review=True
            ),
            
            MigrationRule(
                name="langchain_prompts_import",
                pattern=r"from langchain\.prompts import (.*)",
                replacement="# Migrated: Replace with prompt management system\n# from cartrita_core.prompt_manager import \\1",
                description="Replace LangChain prompt imports",
                category="imports",
                requires_manual_review=True
            ),
            
            MigrationRule(
                name="langchain_chains_import",
                pattern=r"from langchain\.chains import (.*)",
                replacement="# Migrated: Replace with orchestrator pattern\n# from cartrita_core.orchestrator_agent import \\1",
                description="Replace LangChain chains with orchestrator pattern",
                category="imports",
                requires_manual_review=True
            ),
            
            MigrationRule(
                name="langchain_memory_import",
                pattern=r"from langchain\.memory import (.*)",
                replacement="# Migrated: Replace with conversation state management\n# Custom memory implementation needed",
                description="Replace LangChain memory imports",
                category="imports",
                requires_manual_review=True
            ),
        ])
        
        # Model initialization transformations
        self.migration_rules.extend([
            MigrationRule(
                name="openai_model_init",
                pattern=r"OpenAI\(\s*openai_api_key\s*=\s*([^,)]+)(?:,\s*model_name\s*=\s*[\"']([^\"']+)[\"'])?\s*\)",
                replacement="OpenAI(api_key=\\1)",
                description="Transform LangChain OpenAI initialization to native OpenAI client",
                category="initialization"
            ),
            
            MigrationRule(
                name="chat_openai_model_init",
                pattern=r"ChatOpenAI\(\s*openai_api_key\s*=\s*([^,)]+)(?:,\s*model_name\s*=\s*[\"']([^\"']+)[\"'])?\s*\)",
                replacement="OpenAI(api_key=\\1)",
                description="Transform ChatOpenAI initialization to native OpenAI client",
                category="initialization"
            ),
            
            MigrationRule(
                name="langchain_llm_init",
                pattern=r"(\w+)LLM\(\s*(.*)\s*\)",
                replacement="# Migrated: Replace with OpenAI client initialization\n# OpenAI(api_key=your_api_key)",
                description="Generic LangChain LLM initialization replacement",
                category="initialization",
                requires_manual_review=True
            ),
        ])
        
        # Method call transformations
        self.migration_rules.extend([
            MigrationRule(
                name="llm_call_method",
                pattern=r"(\w+)\.call\(\s*([^)]+)\s*\)",
                replacement="# Migrated: Replace with OpenAI client call\n# await \\1.chat.completions.create(messages=[{\"role\": \"user\", \"content\": \\2}])",
                description="Transform LangChain call method to OpenAI API",
                category="method_calls",
                requires_manual_review=True
            ),
            
            MigrationRule(
                name="llm_predict_method",
                pattern=r"(\w+)\.predict\(\s*([^)]+)\s*\)",
                replacement="# Migrated: Replace with OpenAI client call\n# response = await \\1.chat.completions.create(messages=[{\"role\": \"user\", \"content\": \\2}])\n# return response.choices[0].message.content",
                description="Transform LangChain predict method to OpenAI API",
                category="method_calls",
                requires_manual_review=True
            ),
            
            MigrationRule(
                name="chat_model_call",
                pattern=r"(\w+)\.call\(\s*messages\s*=\s*([^)]+)\s*\)",
                replacement="# Migrated: Replace with OpenAI client call\n# response = await \\1.chat.completions.create(messages=\\2)\n# return response.choices[0].message",
                description="Transform chat model call to OpenAI API",
                category="method_calls",
                requires_manual_review=True
            ),
        ])
        
        # Chain transformations
        self.migration_rules.extend([
            MigrationRule(
                name="simple_sequential_chain",
                pattern=r"SimpleSequentialChain\(\s*chains\s*=\s*\[([^\]]+)\]\s*\)",
                replacement="# Migrated: Replace with orchestrator pattern\n# Use orchestrator_agent.execute_sequential_workflow([\\1])",
                description="Transform SimpleSequentialChain to orchestrator pattern",
                category="chains",
                requires_manual_review=True
            ),
            
            MigrationRule(
                name="llm_chain",
                pattern=r"LLMChain\(\s*llm\s*=\s*([^,]+),\s*prompt\s*=\s*([^)]+)\s*\)",
                replacement="# Migrated: Replace with prompt + OpenAI call\n# Use prompt_manager and orchestrator_agent",
                description="Transform LLMChain to direct OpenAI calls with prompt management",
                category="chains",
                requires_manual_review=True
            ),
            
            MigrationRule(
                name="conversation_chain",
                pattern=r"ConversationChain\(\s*llm\s*=\s*([^,]+)(?:,\s*memory\s*=\s*([^)]+))?\s*\)",
                replacement="# Migrated: Replace with conversation state management\n# Use enhanced_chat_routes with conversation context",
                description="Transform ConversationChain to stateful conversation management",
                category="chains",
                requires_manual_review=True
            ),
        ])
        
        # Prompt template transformations
        self.migration_rules.extend([
            MigrationRule(
                name="prompt_template",
                pattern=r"PromptTemplate\(\s*input_variables\s*=\s*\[([^\]]+)\],\s*template\s*=\s*([^)]+)\s*\)",
                replacement="# Migrated: Replace with prompt management system\n# Use prompt_manager.create_template([\\1], \\2)",
                description="Transform PromptTemplate to prompt management system",
                category="prompts",
                requires_manual_review=True
            ),
            
            MigrationRule(
                name="chat_prompt_template",
                pattern=r"ChatPromptTemplate\.from_template\(\s*([^)]+)\s*\)",
                replacement="# Migrated: Replace with prompt management system\n# Use prompt_manager.create_chat_template(\\1)",
                description="Transform ChatPromptTemplate to prompt management system",
                category="prompts",
                requires_manual_review=True
            ),
            
            MigrationRule(
                name="few_shot_prompt_template",
                pattern=r"FewShotPromptTemplate\(\s*(.*)\s*\)",
                replacement="# Migrated: Replace with few-shot prompt management\n# Use prompt_manager.create_few_shot_template(...)",
                description="Transform FewShotPromptTemplate to prompt management system",
                category="prompts",
                requires_manual_review=True
            ),
        ])
        
        # Memory transformations
        self.migration_rules.extend([
            MigrationRule(
                name="conversation_buffer_memory",
                pattern=r"ConversationBufferMemory\(\s*(.*)\s*\)",
                replacement="# Migrated: Replace with conversation state management\n# Use conversation context in enhanced_chat_routes",
                description="Transform ConversationBufferMemory to custom state management",
                category="memory",
                requires_manual_review=True
            ),
            
            MigrationRule(
                name="conversation_summary_memory",
                pattern=r"ConversationSummaryMemory\(\s*(.*)\s*\)",
                replacement="# Migrated: Replace with compression utility\n# Use enhanced_compression_utility for conversation summarization",
                description="Transform ConversationSummaryMemory to compression utility",
                category="memory",
                requires_manual_review=True
            ),
        ])
        
        # Output parser transformations
        self.migration_rules.extend([
            MigrationRule(
                name="output_parsers",
                pattern=r"from langchain\.output_parsers import (.*)",
                replacement="# Migrated: Replace with schema validation\n# from cartrita_core.schema_validator import validate_response",
                description="Replace output parsers with schema validation",
                category="parsing",
                requires_manual_review=True
            ),
            
            MigrationRule(
                name="pydantic_output_parser",
                pattern=r"PydanticOutputParser\(\s*pydantic_object\s*=\s*([^)]+)\s*\)",
                replacement="# Migrated: Replace with schema validation\n# Use schema_validator.create_validator(\\1)",
                description="Transform PydanticOutputParser to schema validation",
                category="parsing",
                requires_manual_review=True
            ),
        ])
        
        # Async pattern transformations
        self.migration_rules.extend([
            MigrationRule(
                name="async_langchain_calls",
                pattern=r"await (\w+)\.apredict\(\s*([^)]+)\s*\)",
                replacement="# Migrated: Replace with async OpenAI call\n# response = await \\1.chat.completions.create(messages=[{\"role\": \"user\", \"content\": \\2}])\n# return response.choices[0].message.content",
                description="Transform async LangChain calls to OpenAI async API",
                category="async",
                requires_manual_review=True
            ),
            
            MigrationRule(
                name="async_chain_calls",
                pattern=r"await (\w+)\.arun\(\s*([^)]+)\s*\)",
                replacement="# Migrated: Replace with orchestrator async execution\n# return await orchestrator_agent.execute_workflow(\\2)",
                description="Transform async chain runs to orchestrator execution",
                category="async",
                requires_manual_review=True
            ),
        ])
        
    def analyze_codebase(self) -> Dict[str, Any]:
        """Analyze the codebase to identify LangChain usage patterns"""
        analysis = {
            "python_files": [],
            "langchain_usage": defaultdict(list),
            "migration_complexity": "low",
            "estimated_effort": "1-2 days",
            "required_components": set()
        }
        
        # Find all Python files
        for py_file in self.source_directory.rglob("*.py"):
            if py_file.is_file():
                analysis["python_files"].append(str(py_file))
                
                try:
                    content = py_file.read_text(encoding='utf-8')
                    
                    # Detect LangChain imports and usage
                    langchain_patterns = [
                        (r"from langchain", "import"),
                        (r"import langchain", "import"),
                        (r"\.chains\.", "chains"),
                        (r"\.llms\.", "llms"),
                        (r"\.chat_models\.", "chat_models"),
                        (r"\.memory\.", "memory"),
                        (r"\.prompts\.", "prompts"),
                        (r"\.output_parsers\.", "output_parsers"),
                        (r"ChatOpenAI", "chat_model"),
                        (r"LLMChain", "chain"),
                        (r"ConversationChain", "conversation"),
                    ]
                    
                    for pattern, category in langchain_patterns:
                        matches = re.finditer(pattern, content)
                        for match in matches:
                            line_num = content[:match.start()].count('\n') + 1
                            analysis["langchain_usage"][category].append({
                                "file": str(py_file),
                                "line": line_num,
                                "match": match.group()
                            })
                            
                except Exception as e:
                    self.logger.error(f"Failed to analyze {py_file}: {e}")
                    
        # Determine complexity
        total_usages = sum(len(usages) for usages in analysis["langchain_usage"].values())
        if total_usages > 50:
            analysis["migration_complexity"] = "high"
            analysis["estimated_effort"] = "1-2 weeks"
        elif total_usages > 20:
            analysis["migration_complexity"] = "medium"
            analysis["estimated_effort"] = "3-5 days"
            
        # Identify required components
        if analysis["langchain_usage"]["chains"]:
            analysis["required_components"].add("orchestrator_agent")
        if analysis["langchain_usage"]["memory"]:
            analysis["required_components"].add("conversation_state_management")
        if analysis["langchain_usage"]["prompts"]:
            analysis["required_components"].add("prompt_manager")
        if analysis["langchain_usage"]["output_parsers"]:
            analysis["required_components"].add("schema_validator")
            
        return analysis
        
    def create_backup(self, file_path: Path) -> Optional[str]:
        """Create a backup of the original file"""
        try:
            # Create backup directory if it doesn't exist
            self.backup_directory.mkdir(exist_ok=True, parents=True)
            
            # Create backup file path maintaining directory structure
            relative_path = file_path.relative_to(self.source_directory)
            backup_path = self.backup_directory / relative_path
            backup_path.parent.mkdir(exist_ok=True, parents=True)
            
            # Copy file
            shutil.copy2(file_path, backup_path)
            
            self.logger.info(f"Created backup: {backup_path}")
            return str(backup_path)
            
        except Exception as e:
            self.logger.error(f"Failed to create backup for {file_path}: {e}")
            return None
            
    def apply_rule(self, content: str, rule: MigrationRule) -> List[MigrationResult]:
        """Apply a single migration rule to content"""
        results = []
        
        try:
            # Find all matches
            for match in re.finditer(rule.pattern, content, re.MULTILINE):
                line_number = content[:match.start()].count('\n') + 1
                original_code = match.group()
                
                # Apply replacement
                migrated_code = re.sub(rule.pattern, rule.replacement, original_code)
                
                result = MigrationResult(
                    rule_name=rule.name,
                    file_path="",  # Will be set by caller
                    line_number=line_number,
                    original_code=original_code,
                    migrated_code=migrated_code,
                    success=True,
                    requires_manual_review=rule.requires_manual_review
                )
                
                results.append(result)
                
            # Apply all replacements
            if results:
                content = re.sub(rule.pattern, rule.replacement, content, flags=re.MULTILINE)
                
        except Exception as e:
            error_result = MigrationResult(
                rule_name=rule.name,
                file_path="",
                line_number=0,
                original_code="",
                migrated_code="",
                success=False,
                error_message=str(e),
                requires_manual_review=True
            )
            results.append(error_result)
            
        return results, content
        
    def migrate_file(self, file_path: Path) -> FileMigration:
        """Migrate a single Python file"""
        try:
            # Read original content
            original_content = file_path.read_text(encoding='utf-8')
            migrated_content = original_content
            
            # Create backup
            backup_path = self.create_backup(file_path)
            
            # Apply migration rules
            applied_rules = []
            manual_review_required = False
            
            for rule in self.migration_rules:
                rule_results, migrated_content = self.apply_rule(migrated_content, rule)
                
                for result in rule_results:
                    result.file_path = str(file_path)
                    applied_rules.append(result)
                    
                    if result.requires_manual_review or not result.success:
                        manual_review_required = True
                        
            # Add migration header comment
            if applied_rules:
                migration_header = f"""# MIGRATION NOTICE: This file has been migrated from LangChain to OpenAI Responses API
# Migration Date: {datetime.now().isoformat()}
# Applied Rules: {', '.join(r.rule_name for r in applied_rules if r.success)}
# Manual Review Required: {manual_review_required}

"""
                migrated_content = migration_header + migrated_content
                
            # Format code if tools are available
            if BLACK_AVAILABLE and migrated_content != original_content:
                try:
                    migrated_content = black.format_str(migrated_content, mode=black.Mode())
                except Exception as e:
                    self.logger.warning(f"Black formatting failed for {file_path}: {e}")
                    
            if ISORT_AVAILABLE and migrated_content != original_content:
                try:
                    migrated_content = isort.code(migrated_content)
                except Exception as e:
                    self.logger.warning(f"isort failed for {file_path}: {e}")
                    
            result = FileMigration(
                file_path=str(file_path),
                original_content=original_content,
                migrated_content=migrated_content,
                applied_rules=applied_rules,
                backup_path=backup_path,
                manual_review_required=manual_review_required,
                migration_timestamp=datetime.now().isoformat()
            )
            
            return result
            
        except Exception as e:
            self.logger.error(f"Failed to migrate {file_path}: {e}")
            return FileMigration(
                file_path=str(file_path),
                original_content="",
                migrated_content="",
                applied_rules=[],
                manual_review_required=True
            )
            
    def migrate_codebase(self, dry_run: bool = False) -> Dict[str, Any]:
        """Migrate the entire codebase"""
        self.logger.info(f"Starting codebase migration (dry_run={dry_run})")
        
        migration_results = {
            "started_at": datetime.now().isoformat(),
            "dry_run": dry_run,
            "file_migrations": [],
            "summary": {},
            "manual_review_files": [],
            "errors": []
        }
        
        # Find Python files with LangChain usage
        python_files = list(self.source_directory.rglob("*.py"))
        langchain_files = []
        
        for py_file in python_files:
            try:
                content = py_file.read_text(encoding='utf-8')
                if re.search(r"langchain|LangChain", content):
                    langchain_files.append(py_file)
            except Exception as e:
                self.logger.error(f"Failed to read {py_file}: {e}")
                migration_results["errors"].append(f"Read error: {py_file} - {e}")
                
        self.logger.info(f"Found {len(langchain_files)} files with LangChain usage")
        
        # Migrate each file
        for file_path in langchain_files:
            self.logger.info(f"Migrating {file_path}")
            
            file_migration = self.migrate_file(file_path)
            migration_results["file_migrations"].append(asdict(file_migration))
            
            # Update statistics
            self.stats["files_processed"] += 1
            
            if file_migration.applied_rules:
                self.stats["files_migrated"] += 1
                self.stats["rules_applied"] += len([r for r in file_migration.applied_rules if r.success])
                
            if file_migration.manual_review_required:
                self.stats["manual_reviews_required"] += 1
                migration_results["manual_review_files"].append(file_migration.file_path)
                
            # Write migrated content if not dry run
            if not dry_run and file_migration.migrated_content != file_migration.original_content:
                try:
                    Path(file_path).write_text(file_migration.migrated_content, encoding='utf-8')
                    self.logger.info(f"Updated {file_path}")
                except Exception as e:
                    self.logger.error(f"Failed to write {file_path}: {e}")
                    self.stats["errors"] += 1
                    migration_results["errors"].append(f"Write error: {file_path} - {e}")
                    
        # Generate summary
        migration_results["summary"] = {
            "files_processed": self.stats["files_processed"],
            "files_migrated": self.stats["files_migrated"],
            "rules_applied": self.stats["rules_applied"],
            "manual_reviews_required": self.stats["manual_reviews_required"],
            "errors": self.stats["errors"],
            "completed_at": datetime.now().isoformat()
        }
        
        self.logger.info("Migration completed")
        self.logger.info(f"Summary: {migration_results['summary']}")
        
        return migration_results
        
    def generate_migration_report(self, migration_results: Dict[str, Any]) -> str:
        """Generate a comprehensive migration report"""
        report = f"""
# LangChain to OpenAI Responses API Migration Report

## Summary
- **Migration Date**: {migration_results['started_at']}
- **Dry Run**: {migration_results['dry_run']}
- **Files Processed**: {migration_results['summary']['files_processed']}
- **Files Migrated**: {migration_results['summary']['files_migrated']}
- **Rules Applied**: {migration_results['summary']['rules_applied']}
- **Manual Reviews Required**: {migration_results['summary']['manual_reviews_required']}
- **Errors**: {migration_results['summary']['errors']}

## Files Requiring Manual Review
"""
        
        if migration_results["manual_review_files"]:
            for file_path in migration_results["manual_review_files"]:
                report += f"- `{file_path}`\n"
        else:
            report += "None\n"
            
        report += "\n## Migration Details\n\n"
        
        for file_migration in migration_results["file_migrations"]:
            if file_migration["applied_rules"]:
                report += f"### {file_migration['file_path']}\n"
                report += f"- **Backup**: `{file_migration.get('backup_path', 'N/A')}`\n"
                report += f"- **Manual Review Required**: {file_migration['manual_review_required']}\n"
                report += "- **Applied Rules**:\n"
                
                for rule in file_migration["applied_rules"]:
                    if rule["success"]:
                        report += f"  - ✅ {rule['rule_name']} (Line {rule['line_number']})\n"
                    else:
                        report += f"  - ❌ {rule['rule_name']} (Error: {rule.get('error_message', 'Unknown')})\n"
                        
                report += "\n"
                
        if migration_results["errors"]:
            report += "## Errors\n\n"
            for error in migration_results["errors"]:
                report += f"- {error}\n"
                
        report += f"""
## Next Steps

1. **Review Manual Changes**: All files marked for manual review require developer attention
2. **Test Migrations**: Run comprehensive tests to ensure functionality is preserved
3. **Update Dependencies**: Update requirements.txt to remove LangChain dependencies
4. **Update Documentation**: Update any documentation referencing LangChain patterns

## Migration Components Available

Based on the migration, you may need these Cartrita V2 components:

- `orchestrator_agent.py` - For chain replacements
- `prompt_manager.py` - For prompt template management
- `schema_validator.py` - For output parsing and validation
- `enhanced_compression_utility.py` - For memory and summarization
- `enhanced_chat_routes.py` - For conversation state management

## Rollback Instructions

If rollback is needed:

```bash
# Restore from backup
cp -r {self.backup_directory}/* {self.source_directory}/
```
"""
        
        return report
        
    def create_migration_checklist(self) -> str:
        """Create a post-migration checklist"""
        checklist = """
# Post-Migration Checklist

## Immediate Actions
- [ ] Review all files marked for manual review
- [ ] Update import statements to use OpenAI client
- [ ] Replace LangChain model initialization with OpenAI client setup
- [ ] Test basic functionality with migrated code

## Code Updates
- [ ] Replace LLMChain usage with direct OpenAI API calls
- [ ] Migrate ConversationChain to conversation state management
- [ ] Update prompt templates to use prompt_manager
- [ ] Replace output parsers with schema_validator
- [ ] Update memory implementations with custom solutions

## Testing
- [ ] Run unit tests for migrated components
- [ ] Test end-to-end workflows
- [ ] Validate OpenAI API integration
- [ ] Performance testing with new implementation
- [ ] Cost analysis comparison

## Dependencies
- [ ] Remove langchain from requirements.txt
- [ ] Remove langchain-related dependencies not needed
- [ ] Ensure openai client is properly configured
- [ ] Update Docker configurations if needed

## Documentation
- [ ] Update README with new architecture
- [ ] Document new prompt management approach
- [ ] Update API documentation
- [ ] Create migration notes for team

## Monitoring
- [ ] Set up monitoring for OpenAI API usage
- [ ] Configure cost monitoring
- [ ] Set up performance metrics
- [ ] Configure alerting for failures
"""
        return checklist


def main():
    """Main migration script entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrate LangChain code to OpenAI Responses API")
    parser.add_argument("source_dir", help="Source directory containing Python files")
    parser.add_argument("--backup-dir", help="Backup directory (default: source_dir/migration_backup)")
    parser.add_argument("--dry-run", action="store_true", help="Perform dry run without making changes")
    parser.add_argument("--analyze-only", action="store_true", help="Only analyze codebase, don't migrate")
    parser.add_argument("--report-file", help="Output file for migration report")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")
    
    args = parser.parse_args()
    
    # Set up logging
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(level=log_level, format='%(asctime)s - %(levelname)s - %(message)s')
    
    # Initialize migrator
    migrator = LangChainMigrator(args.source_dir, args.backup_dir)
    
    if args.analyze_only:
        # Analyze codebase only
        print("Analyzing codebase for LangChain usage...")
        analysis = migrator.analyze_codebase()
        
        print(f"\nCodebase Analysis Results:")
        print(f"Python files found: {len(analysis['python_files'])}")
        print(f"Migration complexity: {analysis['migration_complexity']}")
        print(f"Estimated effort: {analysis['estimated_effort']}")
        print(f"Required components: {', '.join(analysis['required_components'])}")
        
        for category, usages in analysis['langchain_usage'].items():
            if usages:
                print(f"\n{category.title()} usage: {len(usages)} instances")
                for usage in usages[:3]:  # Show first 3 examples
                    print(f"  - {usage['file']}:{usage['line']} - {usage['match']}")
                if len(usages) > 3:
                    print(f"  ... and {len(usages) - 3} more")
    else:
        # Perform migration
        print(f"Starting migration (dry_run={args.dry_run})...")
        migration_results = migrator.migrate_codebase(dry_run=args.dry_run)
        
        # Generate report
        report = migrator.generate_migration_report(migration_results)
        
        if args.report_file:
            with open(args.report_file, 'w') as f:
                f.write(report)
            print(f"Migration report saved to: {args.report_file}")
        else:
            print(report)
            
        # Generate checklist
        checklist = migrator.create_migration_checklist()
        checklist_file = Path(args.source_dir) / "migration_checklist.md"
        with open(checklist_file, 'w') as f:
            f.write(checklist)
        print(f"Migration checklist saved to: {checklist_file}")


if __name__ == "__main__":
    main()