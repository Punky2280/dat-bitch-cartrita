#!/usr/bin/env python3
"""
Enhanced Schema Diff Checker with Semantic Versioning Enforcement
Detects breaking changes and enforces proper version bumps
"""

import json
import sys
import re
import os
import subprocess
import hashlib
from typing import Any, Dict, List, Set, Tuple, Optional, Union
from pathlib import Path
from dataclasses import dataclass, field
from enum import Enum
import argparse
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


class ChangeType(Enum):
    """Types of schema changes"""
    BREAKING = "breaking"
    NON_BREAKING = "non_breaking"
    PATCH = "patch"
    DOCUMENTATION = "documentation"


class SeverityLevel(Enum):
    """Severity levels for breaking changes"""
    CRITICAL = "critical"     # Will break existing implementations
    MAJOR = "major"          # Likely to break implementations
    MINOR = "minor"          # May cause issues in edge cases
    WARNING = "warning"      # Should be reviewed but likely safe


@dataclass
class SchemaChange:
    """Represents a detected schema change"""
    path: str
    change_type: ChangeType
    severity: SeverityLevel
    message: str
    old_value: Any = None
    new_value: Any = None
    suggested_version_bump: str = "patch"
    mitigation: Optional[str] = None


@dataclass
class SemanticVersion:
    """Represents a semantic version"""
    major: int
    minor: int
    patch: int
    prerelease: Optional[str] = None
    build: Optional[str] = None
    
    @classmethod
    def from_string(cls, version_str: str) -> 'SemanticVersion':
        """Parse semantic version from string"""
        # Remove 'v' prefix if present
        version_str = version_str.lstrip('v')
        
        # Split on + for build metadata
        if '+' in version_str:
            version_str, build = version_str.split('+', 1)
        else:
            build = None
        
        # Split on - for prerelease
        if '-' in version_str:
            version_str, prerelease = version_str.split('-', 1)
        else:
            prerelease = None
        
        # Parse major.minor.patch
        parts = version_str.split('.')
        if len(parts) != 3:
            raise ValueError(f"Invalid version format: {version_str}")
        
        try:
            major, minor, patch = map(int, parts)
        except ValueError:
            raise ValueError(f"Invalid version numbers: {version_str}")
        
        return cls(
            major=major,
            minor=minor,
            patch=patch,
            prerelease=prerelease,
            build=build
        )
    
    def __str__(self) -> str:
        version = f"{self.major}.{self.minor}.{self.patch}"
        if self.prerelease:
            version += f"-{self.prerelease}"
        if self.build:
            version += f"+{self.build}"
        return version
    
    def bump_major(self) -> 'SemanticVersion':
        return SemanticVersion(self.major + 1, 0, 0)
    
    def bump_minor(self) -> 'SemanticVersion':
        return SemanticVersion(self.major, self.minor + 1, 0)
    
    def bump_patch(self) -> 'SemanticVersion':
        return SemanticVersion(self.major, self.minor, self.patch + 1)


class EnhancedSchemaDiffer:
    """Enhanced schema differ with comprehensive change detection"""
    
    def __init__(self, allowlist_path: Optional[str] = None, strict_mode: bool = True):
        self.allowlist = self._load_allowlist(allowlist_path) if allowlist_path else set()
        self.strict_mode = strict_mode
        self.changes: List[SchemaChange] = []
        
        # Enhanced breaking change patterns
        self.breaking_patterns = {
            'required_field_removed': {
                'severity': SeverityLevel.CRITICAL,
                'version_bump': 'major',
                'message_template': 'Required field "{field}" removed from {path}'
            },
            'type_changed': {
                'severity': SeverityLevel.CRITICAL,
                'version_bump': 'major',
                'message_template': 'Type changed from {old_type} to {new_type} at {path}'
            },
            'enum_narrowed': {
                'severity': SeverityLevel.MAJOR,
                'version_bump': 'major',
                'message_template': 'Enum values reduced from {old_values} to {new_values} at {path}'
            },
            'additional_properties_restricted': {
                'severity': SeverityLevel.MAJOR,
                'version_bump': 'major',
                'message_template': 'additionalProperties changed from {old} to {new} at {path}'
            },
            'constraint_tightened': {
                'severity': SeverityLevel.MINOR,
                'version_bump': 'minor',
                'message_template': '{constraint} constraint tightened from {old} to {new} at {path}'
            },
            'definition_removed': {
                'severity': SeverityLevel.CRITICAL,
                'version_bump': 'major',
                'message_template': 'Schema definition "{definition}" completely removed'
            }
        }
    
    def _load_allowlist(self, path: str) -> Set[str]:
        """Load allowlist of permitted breaking changes"""
        try:
            with open(path) as f:
                data = json.load(f)
                return set(data) if isinstance(data, list) else set()
        except FileNotFoundError:
            logger.warning(f"Allowlist file not found: {path}")
            return set()
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON in allowlist file: {path}")
            return set()
    
    def diff_schemas(self, base_schema: Dict, candidate_schema: Dict) -> List[SchemaChange]:
        """Compare schemas and detect changes"""
        self.changes = []
        
        # Check for removed definitions
        self._check_removed_definitions(base_schema, candidate_schema)
        
        # Recursively compare schema structure
        self._compare_schema_objects(base_schema, candidate_schema, [])
        
        # Check version consistency
        self._validate_version_consistency(base_schema, candidate_schema)
        
        # Sort changes by severity
        self.changes.sort(key=lambda x: (x.severity.value, x.path))
        
        return self.changes
    
    def _check_removed_definitions(self, base: Dict, candidate: Dict):
        """Check for removed $defs definitions"""
        base_defs = base.get("$defs", {})
        candidate_defs = candidate.get("$defs", {})
        
        for def_name in base_defs:
            if def_name not in candidate_defs:
                path = f"/$defs/{def_name}"
                if path not in self.allowlist:
                    self.changes.append(SchemaChange(
                        path=path,
                        change_type=ChangeType.BREAKING,
                        severity=SeverityLevel.CRITICAL,
                        message=f'Schema definition "{def_name}" removed',
                        old_value=def_name,
                        new_value=None,
                        suggested_version_bump="major",
                        mitigation="Consider deprecation before removal"
                    ))
    
    def _compare_schema_objects(self, base_obj: Any, candidate_obj: Any, path: List[str]):
        """Recursively compare schema objects"""
        if not isinstance(base_obj, dict) or not isinstance(candidate_obj, dict):
            if base_obj != candidate_obj:
                self._record_type_change(base_obj, candidate_obj, path)
            return
        
        # Check required fields
        self._check_required_fields(base_obj, candidate_obj, path)
        
        # Check type changes
        self._check_type_changes(base_obj, candidate_obj, path)
        
        # Check enum changes
        self._check_enum_changes(base_obj, candidate_obj, path)
        
        # Check constraint changes
        self._check_constraint_changes(base_obj, candidate_obj, path)
        
        # Check additionalProperties changes
        self._check_additional_properties(base_obj, candidate_obj, path)
        
        # Check pattern changes
        self._check_pattern_changes(base_obj, candidate_obj, path)
        
        # Recurse into nested objects
        self._recurse_nested_objects(base_obj, candidate_obj, path)
    
    def _check_required_fields(self, base_obj: Dict, candidate_obj: Dict, path: List[str]):
        """Check for required field changes"""
        base_required = set(base_obj.get("required", []))
        candidate_required = set(candidate_obj.get("required", []))
        
        # Check for removed required fields
        removed_required = base_required - candidate_required
        for field in removed_required:
            field_path = self._path_to_string(path + ["required", field])
            if field_path not in self.allowlist:
                self.changes.append(SchemaChange(
                    path=field_path,
                    change_type=ChangeType.BREAKING,
                    severity=SeverityLevel.CRITICAL,
                    message=f'Required field "{field}" removed from {self._path_to_string(path)}',
                    old_value=list(base_required),
                    new_value=list(candidate_required),
                    suggested_version_bump="major",
                    mitigation=f'Make field "{field}" optional before removal'
                ))
        
        # Check for added required fields (also breaking)
        added_required = candidate_required - base_required
        for field in added_required:
            field_path = self._path_to_string(path + ["required", field])
            if self.strict_mode and field_path not in self.allowlist:
                self.changes.append(SchemaChange(
                    path=field_path,
                    change_type=ChangeType.BREAKING,
                    severity=SeverityLevel.MAJOR,
                    message=f'New required field "{field}" added to {self._path_to_string(path)}',
                    old_value=list(base_required),
                    new_value=list(candidate_required),
                    suggested_version_bump="major",
                    mitigation=f'Consider making field "{field}" optional initially'
                ))
    
    def _check_type_changes(self, base_obj: Dict, candidate_obj: Dict, path: List[str]):
        """Check for type changes"""
        base_type = base_obj.get("type")
        candidate_type = candidate_obj.get("type")
        
        if base_type and candidate_type and base_type != candidate_type:
            type_path = self._path_to_string(path + ["type"])
            if type_path not in self.allowlist:
                # Determine severity based on type compatibility
                severity = self._assess_type_change_severity(base_type, candidate_type)
                
                self.changes.append(SchemaChange(
                    path=type_path,
                    change_type=ChangeType.BREAKING,
                    severity=severity,
                    message=f'Type changed from {base_type} to {candidate_type} at {self._path_to_string(path)}',
                    old_value=base_type,
                    new_value=candidate_type,
                    suggested_version_bump="major" if severity == SeverityLevel.CRITICAL else "minor",
                    mitigation=self._suggest_type_migration(base_type, candidate_type)
                ))
    
    def _check_enum_changes(self, base_obj: Dict, candidate_obj: Dict, path: List[str]):
        """Check for enum changes"""
        base_enum = base_obj.get("enum")
        candidate_enum = candidate_obj.get("enum")
        
        if base_enum and candidate_enum:
            base_set = set(base_enum)
            candidate_set = set(candidate_enum)
            
            # Check for removed enum values
            removed_values = base_set - candidate_set
            if removed_values:
                enum_path = self._path_to_string(path + ["enum"])
                if enum_path not in self.allowlist:
                    self.changes.append(SchemaChange(
                        path=enum_path,
                        change_type=ChangeType.BREAKING,
                        severity=SeverityLevel.MAJOR,
                        message=f'Enum values {removed_values} removed from {self._path_to_string(path)}',
                        old_value=base_enum,
                        new_value=candidate_enum,
                        suggested_version_bump="major",
                        mitigation="Deprecate enum values before removing them"
                    ))
            
            # Check for added enum values (non-breaking)
            added_values = candidate_set - base_set
            if added_values:
                enum_path = self._path_to_string(path + ["enum", "added"])
                self.changes.append(SchemaChange(
                    path=enum_path,
                    change_type=ChangeType.NON_BREAKING,
                    severity=SeverityLevel.WARNING,
                    message=f'Enum values {added_values} added to {self._path_to_string(path)}',
                    old_value=base_enum,
                    new_value=candidate_enum,
                    suggested_version_bump="minor",
                    mitigation="Ensure clients handle unknown enum values gracefully"
                ))
    
    def _check_constraint_changes(self, base_obj: Dict, candidate_obj: Dict, path: List[str]):
        """Check for constraint changes"""
        constraints = [
            "maxItems", "minItems", "maxLength", "minLength", 
            "maximum", "minimum", "multipleOf", "exclusiveMaximum", "exclusiveMinimum"
        ]
        
        for constraint in constraints:
            base_val = base_obj.get(constraint)
            candidate_val = candidate_obj.get(constraint)
            
            if base_val is not None and candidate_val is not None:
                if self._is_constraint_tightened(constraint, base_val, candidate_val):
                    constraint_path = self._path_to_string(path + [constraint])
                    if constraint_path not in self.allowlist:
                        self.changes.append(SchemaChange(
                            path=constraint_path,
                            change_type=ChangeType.BREAKING,
                            severity=SeverityLevel.MINOR,
                            message=f'{constraint} constraint tightened from {base_val} to {candidate_val} at {self._path_to_string(path)}',
                            old_value=base_val,
                            new_value=candidate_val,
                            suggested_version_bump="minor",
                            mitigation="Ensure existing data complies with new constraints"
                        ))
    
    def _check_additional_properties(self, base_obj: Dict, candidate_obj: Dict, path: List[str]):
        """Check for additionalProperties changes"""
        base_additional = base_obj.get("additionalProperties", True)
        candidate_additional = candidate_obj.get("additionalProperties", True)
        
        # Becoming more restrictive is breaking
        if base_additional is True and candidate_additional is False:
            prop_path = self._path_to_string(path + ["additionalProperties"])
            if prop_path not in self.allowlist:
                self.changes.append(SchemaChange(
                    path=prop_path,
                    change_type=ChangeType.BREAKING,
                    severity=SeverityLevel.MAJOR,
                    message=f'additionalProperties changed from true to false at {self._path_to_string(path)}',
                    old_value=base_additional,
                    new_value=candidate_additional,
                    suggested_version_bump="major",
                    mitigation="Consider gradual migration with warnings"
                ))
    
    def _check_pattern_changes(self, base_obj: Dict, candidate_obj: Dict, path: List[str]):
        """Check for regex pattern changes"""
        base_pattern = base_obj.get("pattern")
        candidate_pattern = candidate_obj.get("pattern")
        
        if base_pattern and candidate_pattern and base_pattern != candidate_pattern:
            pattern_path = self._path_to_string(path + ["pattern"])
            if pattern_path not in self.allowlist:
                # Simple heuristic: if new pattern is shorter, it might be more restrictive
                severity = SeverityLevel.MINOR if len(candidate_pattern) < len(base_pattern) else SeverityLevel.WARNING
                
                self.changes.append(SchemaChange(
                    path=pattern_path,
                    change_type=ChangeType.BREAKING if severity == SeverityLevel.MINOR else ChangeType.NON_BREAKING,
                    severity=severity,
                    message=f'Pattern changed from "{base_pattern}" to "{candidate_pattern}" at {self._path_to_string(path)}',
                    old_value=base_pattern,
                    new_value=candidate_pattern,
                    suggested_version_bump="minor" if severity == SeverityLevel.MINOR else "patch",
                    mitigation="Test existing data against new pattern"
                ))
    
    def _recurse_nested_objects(self, base_obj: Dict, candidate_obj: Dict, path: List[str]):
        """Recursively compare nested objects"""
        # Get all keys that exist in either schema
        all_keys = set(base_obj.keys()) | set(candidate_obj.keys())
        
        for key in all_keys:
            if key in ["type", "required", "enum", "pattern", "additionalProperties"]:
                continue  # Already handled
            
            base_val = base_obj.get(key)
            candidate_val = candidate_obj.get(key)
            
            if base_val is not None and candidate_val is not None:
                self._compare_schema_objects(base_val, candidate_val, path + [key])
            elif base_val is not None and candidate_val is None:
                # Property removed
                prop_path = self._path_to_string(path + [key])
                if prop_path not in self.allowlist:
                    self.changes.append(SchemaChange(
                        path=prop_path,
                        change_type=ChangeType.BREAKING,
                        severity=SeverityLevel.MAJOR,
                        message=f'Property "{key}" removed from {self._path_to_string(path)}',
                        old_value=base_val,
                        new_value=None,
                        suggested_version_bump="major"
                    ))
    
    def _record_type_change(self, base_obj: Any, candidate_obj: Any, path: List[str]):
        """Record a fundamental type change"""
        path_str = self._path_to_string(path)
        if path_str not in self.allowlist:
            self.changes.append(SchemaChange(
                path=path_str,
                change_type=ChangeType.BREAKING,
                severity=SeverityLevel.CRITICAL,
                message=f'Fundamental type changed from {type(base_obj).__name__} to {type(candidate_obj).__name__} at {path_str}',
                old_value=base_obj,
                new_value=candidate_obj,
                suggested_version_bump="major"
            ))
    
    def _assess_type_change_severity(self, old_type: str, new_type: str) -> SeverityLevel:
        """Assess the severity of a type change"""
        # Some type changes are more severe than others
        high_impact_changes = [
            ("string", "number"), ("string", "integer"), ("string", "boolean"),
            ("number", "string"), ("integer", "string"), ("boolean", "string"),
            ("object", "array"), ("array", "object")
        ]
        
        if (old_type, new_type) in high_impact_changes:
            return SeverityLevel.CRITICAL
        
        # Narrowing types
        if old_type == "number" and new_type == "integer":
            return SeverityLevel.MINOR
        
        return SeverityLevel.MAJOR
    
    def _suggest_type_migration(self, old_type: str, new_type: str) -> str:
        """Suggest migration strategy for type changes"""
        strategies = {
            ("string", "number"): "Parse string values as numbers during migration",
            ("number", "string"): "Convert numbers to string representation",
            ("object", "array"): "Wrap object in array or restructure data",
            ("array", "object"): "Convert array to object with indexed keys"
        }
        
        return strategies.get((old_type, new_type), "Manual data migration required")
    
    def _is_constraint_tightened(self, constraint: str, old_val: Any, new_val: Any) -> bool:
        """Check if a constraint has been tightened (more restrictive)"""
        if constraint in ["maxItems", "maxLength", "maximum"]:
            return new_val < old_val
        elif constraint in ["minItems", "minLength", "minimum"]:
            return new_val > old_val
        return False
    
    def _validate_version_consistency(self, base_schema: Dict, candidate_schema: Dict):
        """Validate version consistency in schema metadata"""
        base_version = base_schema.get("version")
        candidate_version = candidate_schema.get("version")
        
        if base_version and candidate_version:
            try:
                base_sem_ver = SemanticVersion.from_string(base_version)
                candidate_sem_ver = SemanticVersion.from_string(candidate_version)
                
                # Check if version was properly bumped for breaking changes
                has_breaking = any(c.change_type == ChangeType.BREAKING for c in self.changes)
                has_major_breaking = any(
                    c.change_type == ChangeType.BREAKING and c.severity == SeverityLevel.CRITICAL 
                    for c in self.changes
                )
                
                if has_major_breaking and candidate_sem_ver.major <= base_sem_ver.major:
                    self.changes.append(SchemaChange(
                        path="/version",
                        change_type=ChangeType.BREAKING,
                        severity=SeverityLevel.CRITICAL,
                        message=f'Major breaking changes detected but version only changed from {base_version} to {candidate_version}',
                        suggested_version_bump="major",
                        mitigation="Bump major version for breaking changes"
                    ))
                
            except ValueError as e:
                logger.warning(f"Invalid version format: {e}")
    
    def _path_to_string(self, path: List[str]) -> str:
        """Convert path list to JSON pointer string"""
        if not path:
            return "/"
        return "/" + "/".join(str(p).replace("~", "~0").replace("/", "~1") for p in path)


class SchemaChangeAnalyzer:
    """Analyzes and reports on schema changes"""
    
    def __init__(self, differ: EnhancedSchemaDiffer):
        self.differ = differ
    
    def generate_report(self, changes: List[SchemaChange], format_type: str = "text") -> str:
        """Generate a report of schema changes"""
        if format_type == "json":
            return self._generate_json_report(changes)
        elif format_type == "markdown":
            return self._generate_markdown_report(changes)
        else:
            return self._generate_text_report(changes)
    
    def _generate_text_report(self, changes: List[SchemaChange]) -> str:
        """Generate plain text report"""
        if not changes:
            return "✅ No schema changes detected."
        
        breaking_changes = [c for c in changes if c.change_type == ChangeType.BREAKING]
        non_breaking_changes = [c for c in changes if c.change_type == ChangeType.NON_BREAKING]
        
        report = []
        
        if breaking_changes:
            report.append("💥 BREAKING SCHEMA CHANGES DETECTED:")
            report.append("")
            for change in breaking_changes:
                report.append(f"  ❌ [{change.severity.value.upper()}] {change.message}")
                report.append(f"     Path: {change.path}")
                report.append(f"     Suggested version bump: {change.suggested_version_bump}")
                if change.mitigation:
                    report.append(f"     Mitigation: {change.mitigation}")
                report.append("")
        
        if non_breaking_changes:
            report.append("📝 NON-BREAKING CHANGES:")
            report.append("")
            for change in non_breaking_changes:
                report.append(f"  ⚠️  [{change.severity.value.upper()}] {change.message}")
                report.append(f"     Path: {change.path}")
                if change.mitigation:
                    report.append(f"     Mitigation: {change.mitigation}")
                report.append("")
        
        # Summary
        report.append("📊 SUMMARY:")
        report.append(f"  Total changes: {len(changes)}")
        report.append(f"  Breaking changes: {len(breaking_changes)}")
        report.append(f"  Non-breaking changes: {len(non_breaking_changes)}")
        
        # Recommended version bump
        if breaking_changes:
            critical_changes = [c for c in breaking_changes if c.severity == SeverityLevel.CRITICAL]
            if critical_changes:
                report.append(f"  🚀 Recommended version bump: MAJOR")
            else:
                report.append(f"  🚀 Recommended version bump: MINOR")
        elif non_breaking_changes:
            report.append(f"  🚀 Recommended version bump: MINOR")
        else:
            report.append(f"  🚀 Recommended version bump: PATCH")
        
        return "\n".join(report)
    
    def _generate_json_report(self, changes: List[SchemaChange]) -> str:
        """Generate JSON report"""
        report_data = {
            "summary": {
                "total_changes": len(changes),
                "breaking_changes": len([c for c in changes if c.change_type == ChangeType.BREAKING]),
                "non_breaking_changes": len([c for c in changes if c.change_type == ChangeType.NON_BREAKING])
            },
            "changes": []
        }
        
        for change in changes:
            change_data = {
                "path": change.path,
                "type": change.change_type.value,
                "severity": change.severity.value,
                "message": change.message,
                "suggested_version_bump": change.suggested_version_bump
            }
            
            if change.old_value is not None:
                change_data["old_value"] = change.old_value
            if change.new_value is not None:
                change_data["new_value"] = change.new_value
            if change.mitigation:
                change_data["mitigation"] = change.mitigation
            
            report_data["changes"].append(change_data)
        
        return json.dumps(report_data, indent=2)
    
    def _generate_markdown_report(self, changes: List[SchemaChange]) -> str:
        """Generate Markdown report for GitHub PR comments"""
        if not changes:
            return "## ✅ Schema Changes\n\nNo breaking changes detected."
        
        breaking_changes = [c for c in changes if c.change_type == ChangeType.BREAKING]
        non_breaking_changes = [c for c in changes if c.change_type == ChangeType.NON_BREAKING]
        
        report = ["## 📋 Schema Changes Report"]
        
        if breaking_changes:
            report.append("\n### ❌ Breaking Changes")
            report.append("\n| Severity | Path | Description | Version Bump |")
            report.append("|----------|------|-------------|--------------|")
            
            for change in breaking_changes:
                severity_emoji = {
                    SeverityLevel.CRITICAL: "🔴",
                    SeverityLevel.MAJOR: "🟠", 
                    SeverityLevel.MINOR: "🟡",
                    SeverityLevel.WARNING: "⚪"
                }.get(change.severity, "⚪")
                
                report.append(f"| {severity_emoji} {change.severity.value} | `{change.path}` | {change.message} | {change.suggested_version_bump} |")
        
        if non_breaking_changes:
            report.append("\n### ✅ Non-Breaking Changes")
            report.append("\n| Path | Description |")
            report.append("|------|-------------|")
            
            for change in non_breaking_changes:
                report.append(f"| `{change.path}` | {change.message} |")
        
        # Add summary
        report.append(f"\n### 📊 Summary")
        report.append(f"- **Total changes:** {len(changes)}")
        report.append(f"- **Breaking changes:** {len(breaking_changes)}")
        report.append(f"- **Non-breaking changes:** {len(non_breaking_changes)}")
        
        return "\n".join(report)


def get_git_version_tags() -> List[str]:
    """Get version tags from git"""
    try:
        result = subprocess.run(
            ["git", "tag", "--list", "--sort=-version:refname"],
            capture_output=True,
            text=True,
            check=True
        )
        return [tag.strip() for tag in result.stdout.split('\n') if tag.strip()]
    except subprocess.CalledProcessError:
        return []


def load_schema(file_path: str) -> Dict:
    """Load JSON schema from file"""
    try:
        with open(file_path) as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error(f"Schema file not found: {file_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in schema file {file_path}: {e}")
        sys.exit(1)


def main():
    """Main function for CLI usage"""
    parser = argparse.ArgumentParser(
        description="Enhanced Schema Diff Checker with Semantic Versioning",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Compare against main branch
  python enhanced_schema_diff_check.py schema.json --git-compare main

  # Compare two files with allowlist
  python enhanced_schema_diff_check.py baseline.json candidate.json --allowlist allowlist.json

  # Generate JSON report
  python enhanced_schema_diff_check.py schema.json --git-compare main --format json
        """
    )
    
    parser.add_argument("schema_file", help="Current schema file path")
    parser.add_argument("baseline_file", nargs="?", help="Baseline schema file path")
    parser.add_argument("--git-compare", help="Compare against git branch/tag")
    parser.add_argument("--allowlist", help="Path to allowlist file")
    parser.add_argument("--format", choices=["text", "json", "markdown"], default="text", help="Output format")
    parser.add_argument("--strict", action="store_true", help="Enable strict mode")
    parser.add_argument("--output", help="Output file path")
    parser.add_argument("--fail-on-breaking", action="store_true", help="Exit with error code on breaking changes")
    
    args = parser.parse_args()
    
    # Load current schema
    current_schema = load_schema(args.schema_file)
    
    # Determine baseline schema
    if args.git_compare:
        # Compare against git reference
        temp_file = f"/tmp/baseline_schema_{os.getpid()}.json"
        try:
            subprocess.run(
                ["git", "show", f"{args.git_compare}:{args.schema_file}"],
                stdout=open(temp_file, 'w'),
                check=True
            )
            baseline_schema = load_schema(temp_file)
        except subprocess.CalledProcessError:
            logger.error(f"Failed to get schema from git reference: {args.git_compare}")
            sys.exit(1)
        finally:
            if os.path.exists(temp_file):
                os.remove(temp_file)
    elif args.baseline_file:
        baseline_schema = load_schema(args.baseline_file)
    else:
        logger.error("Must specify either baseline_file or --git-compare")
        sys.exit(1)
    
    # Create differ and analyze
    differ = EnhancedSchemaDiffer(args.allowlist, args.strict)
    changes = differ.diff_schemas(baseline_schema, current_schema)
    
    # Generate report
    analyzer = SchemaChangeAnalyzer(differ)
    report = analyzer.generate_report(changes, args.format)
    
    # Output report
    if args.output:
        with open(args.output, 'w') as f:
            f.write(report)
        logger.info(f"Report written to {args.output}")
    else:
        print(report)
    
    # Exit with appropriate code
    breaking_changes = [c for c in changes if c.change_type == ChangeType.BREAKING]
    if args.fail_on_breaking and breaking_changes:
        logger.error(f"Found {len(breaking_changes)} breaking changes")
        sys.exit(1)
    
    sys.exit(0)


if __name__ == "__main__":
    main()